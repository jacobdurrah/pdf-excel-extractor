from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


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