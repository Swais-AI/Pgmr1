"""
/auth — how the login portal hands a parent to this dashboard.

  POST /auth/sso-token   login portal → us. Shared-secret protected. Email in,
                         signed token out. The portal puts the token in the
                         redirect URL.
  GET  /auth/me          dashboard → us. Bearer token in, parent identity out.
                         The dashboard calls this on load to learn who it is
                         serving instead of trusting localStorage.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import SSO_SECRET, create_parent_token, get_current_parent
from database import get_db
from models import ParentMaster

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


class SSOTokenRequest(BaseModel):
    """
    One of email or phone. The portal sends whichever the parent used to log
    in — Google gives an email, SMS OTP gives a phone. email used to be
    required, so every OTP login was rejected with a 422 before this endpoint
    ran and the portal redirected to the dashboard with no token, leaving every
    API call unauthenticated.
    """

    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # sent by the portal; informational here

    @model_validator(mode="after")
    def _needs_one_identifier(self):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")
        return self


class SSOTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    parent_id: int
    full_name: Optional[str] = None


class MeResponse(BaseModel):
    parent_id: int
    full_name: Optional[str] = None
    email: Optional[str] = None


@router.post("/sso-token", response_model=SSOTokenResponse)
def sso_token(
    payload: SSOTokenRequest,
    x_sso_secret: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not SSO_SECRET or x_sso_secret != SSO_SECRET:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid SSO secret")

    roll = db.query(ParentMaster).order_by(ParentMaster.parent_id)

    if payload.email:
        email = payload.email.strip().lower()
        parent = roll.filter(func.lower(ParentMaster.email) == email).first()
        identifier = f"email={email}"
    else:
        # phone is stored as ten bare digits. Strip whatever the portal sends
        # and compare on digits only, so a +91 prefix or spaces still match.
        digits = "".join(ch for ch in (payload.phone or "") if ch.isdigit())[-10:]
        if len(digits) != 10:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone must contain ten digits")
        parent = roll.filter(
            func.right(func.regexp_replace(ParentMaster.phone, r"\D", "", "g"), 10) == digits
        ).first()
        identifier = f"phone=...{digits[-4:]}"

    if not parent:
        logger.info("[auth/sso-token] no parent for %s", identifier)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent not found")

    logger.info("[auth/sso-token] parent_id=%s", parent.parent_id)
    return SSOTokenResponse(
        access_token=create_parent_token(parent),
        parent_id=parent.parent_id,
        full_name=parent.full_name,
    )


@router.get("/me", response_model=MeResponse)
def me(parent: ParentMaster = Depends(get_current_parent)):
    return MeResponse(parent_id=parent.parent_id, full_name=parent.full_name, email=parent.email)
