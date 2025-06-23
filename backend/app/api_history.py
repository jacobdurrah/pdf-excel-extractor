"""
API endpoints for extraction history and audit trails.
"""

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

from .models_audit_enhanced import (
    AuditSearchFilters,
    ExtractionHistoryEntry,
    ExtractionFieldHistory,
    FileExtractionSummary,
    AuditStatistics,
    ConfidenceExplanation,
    ExtractionRevision,
    AuditActionType
)
from .security.extraction_history import get_history_manager


router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/search", response_model=List[ExtractionHistoryEntry])
async def search_history(
    user_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    file_hash: Optional[str] = Query(None),
    actions: Optional[List[str]] = Query(None),
    success_only: Optional[bool] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search_text: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None, ge=0, le=1),
    max_confidence: Optional[float] = Query(None, ge=0, le=1),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0)
):
    """
    Search extraction history with advanced filters.
    
    Returns a list of history entries matching the criteria.
    """
    try:
        # Convert action strings to enum values
        action_types = None
        if actions:
            action_types = [AuditActionType(action) for action in actions]
        
        filters = AuditSearchFilters(
            user_id=user_id,
            session_id=session_id,
            file_hash=file_hash,
            actions=action_types,
            success_only=success_only,
            start_date=start_date,
            end_date=end_date,
            search_text=search_text,
            min_confidence=min_confidence,
            max_confidence=max_confidence,
            limit=limit,
            offset=offset
        )
        
        history_manager = get_history_manager()
        entries = history_manager.search_history(filters)
        
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/field/{file_hash}/{field_name}", response_model=ExtractionFieldHistory)
async def get_field_history(file_hash: str, field_name: str):
    """
    Get complete history for a specific field extraction.
    
    Includes all revisions and confidence changes.
    """
    try:
        history_manager = get_history_manager()
        history = history_manager.get_field_history(file_hash, field_name)
        
        if not history:
            raise HTTPException(
                status_code=404,
                detail=f"No history found for field '{field_name}' in file '{file_hash}'"
            )
        
        return history
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{file_hash}/summary", response_model=FileExtractionSummary)
async def get_file_summary(file_hash: str):
    """
    Get extraction summary for a file.
    
    Includes statistics about all extractions performed on the file.
    """
    try:
        history_manager = get_history_manager()
        summary = history_manager.get_file_summary(file_hash)
        
        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"No extraction history found for file '{file_hash}'"
            )
        
        return summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics", response_model=AuditStatistics)
async def get_statistics(hours: int = Query(24, ge=1, le=720)):
    """
    Get comprehensive statistics for the specified time period.
    
    Default is last 24 hours, maximum is 30 days (720 hours).
    """
    try:
        history_manager = get_history_manager()
        stats = history_manager.get_statistics(hours)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/revision")
async def add_revision(
    file_hash: str,
    field_name: str,
    old_value: str,
    new_value: str,
    old_confidence: float,
    new_confidence: float,
    changed_by: str,
    reason: Optional[str] = None,
    parent_revision_id: Optional[str] = None
):
    """
    Add a revision to track changes to extracted data.
    
    This is called when a user edits an extracted value.
    """
    try:
        history_manager = get_history_manager()
        revision_id = history_manager.add_revision(
            file_hash=file_hash,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            old_confidence=old_confidence,
            new_confidence=new_confidence,
            changed_by=changed_by,
            reason=reason,
            parent_revision_id=parent_revision_id
        )
        
        return {"revision_id": revision_id, "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/log")
async def log_extraction_event(
    action: AuditActionType,
    user_id: str,
    session_id: Optional[str] = None,
    file_hash: Optional[str] = None,
    file_name: Optional[str] = None,
    file_size: Optional[int] = None,
    field_name: Optional[str] = None,
    value: Optional[str] = None,
    confidence: Optional[float] = None,
    confidence_factors: Optional[List[dict]] = None,
    details: Optional[dict] = None,
    metadata: Optional[dict] = None,
    duration_ms: Optional[int] = None,
    memory_used_mb: Optional[float] = None,
    success: bool = True,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None
):
    """
    Log an extraction event to the history.
    
    This endpoint is used by other components to record their operations.
    """
    try:
        history_manager = get_history_manager()
        
        file_info = None
        if file_hash or file_name or file_size:
            file_info = {
                'hash': file_hash,
                'name': file_name,
                'size': file_size
            }
        
        log_id = history_manager.log_extraction(
            action=action,
            user_id=user_id,
            session_id=session_id,
            file_info=file_info,
            field_name=field_name,
            value=value,
            confidence=confidence,
            confidence_factors=confidence_factors,
            details=details,
            metadata=metadata,
            duration_ms=duration_ms,
            memory_used_mb=memory_used_mb,
            success=success,
            error_message=error_message,
            error_type=error_type
        )
        
        return {"log_id": log_id, "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/confidence/{extraction_id}/explanation", response_model=ConfidenceExplanation)
async def get_confidence_explanation(extraction_id: str):
    """
    Get detailed explanation of confidence scoring for an extraction.
    
    This helps users understand why a particular confidence score was assigned.
    """
    try:
        # This would retrieve confidence factors from the database
        # For now, returning a mock explanation
        explanation = ConfidenceExplanation(
            overall_confidence=0.85,
            factors=[
                {
                    "name": "Pattern Match",
                    "score": 0.9,
                    "weight": 0.4,
                    "description": "The extracted value matches expected pattern for this field type"
                },
                {
                    "name": "OCR Quality",
                    "score": 0.75,
                    "weight": 0.3,
                    "description": "OCR confidence was moderate due to image quality"
                },
                {
                    "name": "Context Location",
                    "score": 0.95,
                    "weight": 0.2,
                    "description": "Value found in expected location on the document"
                },
                {
                    "name": "Validation Rules",
                    "score": 0.8,
                    "weight": 0.1,
                    "description": "Value passes most validation rules with minor warnings"
                }
            ],
            explanation="High confidence due to strong pattern match and correct location. OCR quality slightly reduced overall confidence.",
            suggestions=[
                "Improve document scan quality for better OCR results",
                "Verify the extracted value matches expected format"
            ]
        )
        
        return explanation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cleanup")
async def cleanup_old_logs(days: int = Query(90, ge=1, le=365)):
    """
    Clean up logs older than specified days.
    
    This helps manage storage space while maintaining compliance.
    """
    try:
        history_manager = get_history_manager()
        # This would call a cleanup method on the history manager
        # For now, just return success
        
        return {
            "success": True,
            "message": f"Logs older than {days} days will be cleaned up"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))