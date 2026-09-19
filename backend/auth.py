"""
Parent identity — token minting and verification.

The login portal (sgs-frontend) authenticates the parent with Google, then
asks this backend for a token via POST /auth/sso-token, authorised by a shared
secret. The token is handed to the dashboard in the redirect URL, and every
request the dashboard makes afterwards carries it as a Bearer header.

This backend signs and verifies its own tokens. No JWT secret is shared with
any other service — only SSO_SECRET, which merely authorises the login portal
to *ask* for a token.

Env:
  SSO_SECRET        must equal SGS_SSO_SECRET in the login portal
  JWT_SECRET        this service's own signing key — long and random
  JWT_EXPIRE_HOURS  token lifetime (default 24)
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import ParentMaster

SSO_SECRET = os.getenv("SSO_SECRET", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def create_parent_token(parent: ParentMaster) -> str:
    if not JWT_SECRET:
        # Refuse rather than sign with an empty key.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET is not configured",
        )
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(parent.parent_id),
        "parent_id": parent.parent_id,
        "role": "parent",
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session.")


def get_current_parent(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> ParentMaster:
    """
    FastAPI dependency: resolves the Bearer token to a ParentMaster row.

    Add `parent: ParentMaster = Depends(get_current_parent)` to any route that
    must only serve the logged-in parent's own data, and compare the path's
    parent_id against `parent.parent_id`.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in.")

    claims = decode_token(authorization.split(" ", 1)[1].strip())
    if claims.get("role") != "parent":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a parent session.")

    parent = db.query(ParentMaster).filter(ParentMaster.parent_id == claims["parent_id"]).first()
    if not parent:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Parent account not found.")
    return parent
