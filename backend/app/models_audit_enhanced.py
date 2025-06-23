"""
Enhanced audit models for frontend display and tracking
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


class AuditActionType(str, Enum):
    """Types of actions that can be audited with frontend-friendly values."""
    UPLOAD = "upload"
    EXTRACT = "extract"
    EDIT = "edit"
    EXPORT = "export"
    DELETE = "delete"
    VIEW = "view"
    ERROR = "error"
    SECURITY = "security"
    REVISION = "revision"  # For tracking edits/changes
    CONFIDENCE_CHANGE = "confidence_change"  # When confidence changes
    VALIDATION = "validation"  # Data validation events


class ExtractionRevision(BaseModel):
    """Track revisions to extracted data."""
    revision_id: str
    parent_revision_id: Optional[str] = None
    timestamp: datetime
    field_name: str
    old_value: Optional[str] = None
    new_value: str
    old_confidence: Optional[float] = None
    new_confidence: float
    changed_by: str  # 'user' or 'system'
    reason: Optional[str] = None  # Why the change was made
    

class ExtractionFieldHistory(BaseModel):
    """Complete history for a single extracted field."""
    field_name: str
    current_value: str
    current_confidence: float
    original_value: str
    original_confidence: float
    revision_count: int
    revisions: List[ExtractionRevision]
    last_modified: datetime


class FileExtractionSummary(BaseModel):
    """Summary of all extractions for a file."""
    file_hash: str
    file_name: str
    upload_date: datetime
    last_modified: datetime
    total_extractions: int
    successful_extractions: int
    failed_extractions: int
    average_confidence: float
    fields_extracted: List[str]
    revision_count: int
    export_count: int
    

class AuditLogEnhanced(BaseModel):
    """Enhanced audit log for frontend display."""
    # Base fields from original
    id: str
    timestamp: datetime
    action: AuditActionType
    user_id: str
    session_id: Optional[str] = None
    
    # File information
    file_hash: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    
    # Operation details
    details: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}  # Additional context
    
    # Performance metrics
    duration_ms: Optional[int] = None
    memory_used_mb: Optional[float] = None
    
    # Results
    success: bool = True
    error_message: Optional[str] = None
    error_type: Optional[str] = None
    
    # Extraction specific
    fields_affected: List[str] = []
    confidence_before: Optional[float] = None
    confidence_after: Optional[float] = None
    confidence_breakdown: Optional[Dict[str, float]] = None
    
    # UI display helpers
    display_message: Optional[str] = None
    severity: Literal["info", "warning", "error", "success"] = "info"
    is_user_action: bool = True  # False for system actions
    

class AuditSearchFilters(BaseModel):
    """Filters for searching audit logs."""
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    file_hash: Optional[str] = None
    actions: Optional[List[AuditActionType]] = None
    success_only: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    search_text: Optional[str] = None  # Search in details/messages
    min_confidence: Optional[float] = None
    max_confidence: Optional[float] = None
    limit: int = Field(default=100, le=1000)
    offset: int = Field(default=0, ge=0)


class AuditStatistics(BaseModel):
    """Statistics from audit logs."""
    total_operations: int
    successful_operations: int
    failed_operations: int
    success_rate: float
    
    # By action type
    operations_by_type: Dict[str, int]
    
    # Time-based
    operations_last_hour: int
    operations_last_24h: int
    operations_last_7d: int
    
    # File statistics
    unique_files_processed: int
    total_extractions: int
    average_confidence: float
    
    # User statistics
    active_users: int
    operations_per_user: Dict[str, int]
    
    # Performance
    average_duration_ms: float
    average_memory_mb: float
    

class ExtractionHistoryEntry(BaseModel):
    """Single entry in extraction history view."""
    timestamp: datetime
    file_name: str
    file_hash: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    confidence: Optional[float] = None
    confidence_change: Optional[float] = None
    user_action: bool = True
    success: bool = True
    duration_ms: Optional[int] = None
    display_icon: str  # Icon name for UI
    display_color: str  # Color for UI
    

class ConfidenceExplanation(BaseModel):
    """Detailed explanation of confidence scoring."""
    overall_confidence: float
    factors: List[Dict[str, Any]]  # Each factor with name, score, weight, description
    explanation: str  # Human-readable explanation
    suggestions: List[str]  # How to improve confidence
    

class SecurityAuditEvent(BaseModel):
    """Security-specific audit event."""
    event_type: Literal["file_blocked", "validation_failed", "memory_limit", "suspicious_pattern"]
    severity: Literal["low", "medium", "high", "critical"]
    details: Dict[str, Any]
    blocked: bool = False
    remediation: Optional[str] = None