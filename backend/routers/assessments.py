from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from schemas import AssessmentResultSchema, AssessmentAnalyticsResponse
from services.assessments_service import get_history, get_analytics
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/assessments/history/{student_id}", response_model=List[AssessmentResultSchema])
def assessment_history(student_id: int, db: Session = Depends(get_db)):
    try:
        return get_history(db, student_id)
    except Exception as exc:
        logger.error("[assessments/history] student_id=%s error: %s", student_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/assessments/analytics/{student_id}", response_model=AssessmentAnalyticsResponse)
def assessment_analytics(student_id: int, db: Session = Depends(get_db)):
    try:
        return get_analytics(db, student_id)
    except Exception as exc:
        logger.error("[assessments/analytics] student_id=%s error: %s", student_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))
