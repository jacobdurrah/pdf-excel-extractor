from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class ExtractionMode(str, Enum):
    STEP_BY_STEP = "step-by-step"
    BATCH = "batch"


class Region(BaseModel):
    x: float
    y: float
    width: float
    height: float
    page: int = 1


class UploadResponse(BaseModel):
    file_id: str = Field(..., alias="fileId")
    page_count: int = Field(..., alias="pageCount")
    file_size: int = Field(..., alias="fileSize")

    class Config:
        populate_by_name = True


class ProcessRequest(BaseModel):
    file_id: str = Field(..., alias="fileId")
    mode: ExtractionMode
    template: Optional[str] = None

    class Config:
        populate_by_name = True


class ProcessResponse(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    status: str

    class Config:
        populate_by_name = True


class ExtractedField(BaseModel):
    name: str
    value: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    page: int
    region: Optional[Region] = None


class StepExtractionRequest(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    field_name: str = Field(..., alias="fieldName")
    region: Optional[Region] = None

    class Config:
        populate_by_name = True


class StepExtractionResponse(BaseModel):
    value: str
    confidence: float
    next_field: Optional[str] = Field(None, alias="nextField")

    class Config:
        populate_by_name = True


class ExtractionResult(BaseModel):
    fields: List[ExtractedField]
    total_confidence: float
    processing_time: float


# Security Models
class SecurityConfig(BaseModel):
    """Security configuration settings."""
    max_file_size_mb: int = 100
    allowed_extensions: List[str] = [".pdf"]
    temp_file_lifetime_seconds: int = 3600
    memory_limit_mb: int = 500
    secure_delete_passes: int = 3
    audit_retention_days: int = 90


class AuditLog(BaseModel):
    """Audit log entry."""
    id: str
    timestamp: datetime
    action: str
    user_id: str
    file_hash: Optional[str] = None
    details: Dict[str, Any] = {}
    confidence_before: Optional[float] = None
    confidence_after: Optional[float] = None
    duration_ms: Optional[int] = None
    success: bool = True
    error_message: Optional[str] = None