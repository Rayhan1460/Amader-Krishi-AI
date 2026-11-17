# Prediction History router for AgriSphere AI with cross-user isolation

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..db import get_db, PredictionRecord, User
from .auth import get_current_user

router = APIRouter()


class PredictionRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    model_id: str
    request_payload: Dict[str, Any]
    response: Dict[str, Any]
    timestamp: Any


@router.get("/", response_model=List[PredictionRecordResponse], summary="List authenticated user's prediction history")
def list_prediction_history(
    limit: int = 50,
    model_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve logged prediction history records belonging strictly to the authenticated user."""
    query = db.query(PredictionRecord).filter(PredictionRecord.user_id == current_user.id)
    if model_id:
        query = query.filter(PredictionRecord.model_id == model_id)
    records = query.order_by(PredictionRecord.id.desc()).limit(limit).all()
    return records


@router.get("/{record_id}", response_model=PredictionRecordResponse, summary="Get prediction record with ownership check")
def get_prediction_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single prediction history record ensuring caller ownership."""
    record = db.query(PredictionRecord).filter(PredictionRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction record {record_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to access another user's prediction record",
        )
    return record


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete prediction record with ownership check")
def delete_prediction_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a single prediction history record ensuring caller ownership."""
    record = db.query(PredictionRecord).filter(PredictionRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction record {record_id} not found",
        )
    if record.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you do not have permission to delete another user's prediction record",
        )
    db.delete(record)
    db.commit()
    return None
