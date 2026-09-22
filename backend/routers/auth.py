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
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import SSO_SECRET, create_parent_token, get_current_parent
from database import get_db
from models import ParentMaster

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Auth"])


class SSOTokenRequest(BaseModel):
    email: str
    role: Optional[str] = None  # sent by the portal; informational here


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

    email = payload.email.strip().lower()
    parent = (
        db.query(ParentMaster)
        .filter(func.lower(ParentMaster.email) == email)
        .order_by(ParentMaster.parent_id)
        .first()
    )
    if not parent:
        logger.info("[auth/sso-token] no parent for email=%s", email)
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
