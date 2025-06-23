"""
Message Protocol Definitions for IPC Communication

This module defines the comprehensive message schema for all IPC communications
between the Electron frontend and Python backend.
"""

from typing import Dict, Any, Optional, List, Union
from enum import Enum
from dataclasses import dataclass, field, asdict
from datetime import datetime
import uuid


class MessageType(Enum):
    """All supported message types"""
    # System messages
    PING = "ping"
    PONG = "pong"
    SHUTDOWN = "shutdown"
    
    # Extraction messages
    EXTRACTION_PROCESS = "extraction.process"
    EXTRACTION_CANCEL = "extraction.cancel"
    EXTRACTION_PROGRESS = "extraction.progress"
    EXTRACTION_COMPLETE = "extraction.complete"
    EXTRACTION_ERROR = "extraction.error"
    
    # Export messages
    EXPORT_EXCEL = "export.excel"
    EXPORT_PROGRESS = "export.progress"
    EXPORT_COMPLETE = "export.complete"
    EXPORT_ERROR = "export.error"
    
    # File messages
    FILE_READ = "file.read"
    FILE_VALIDATE = "file.validate"
    FILE_CHUNK = "file.chunk"
    
    # Session messages
    SESSION_CREATE = "session.create"
    SESSION_UPDATE = "session.update"
    SESSION_DELETE = "session.delete"
    SESSION_LIST = "session.list"


class MessageStatus(Enum):
    """Message status values"""
    SUCCESS = "success"
    ERROR = "error"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    CANCELLED = "cancelled"


class Priority(Enum):
    """Message priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class MessageHeader:
    """Standard message header"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""
    timestamp: int = field(default_factory=lambda: int(datetime.now().timestamp() * 1000))
    version: str = "1.0"
    correlation_id: Optional[str] = None
    priority: Priority = Priority.NORMAL
    timeout: Optional[int] = None  # milliseconds
    retry_count: int = 0
    max_retries: int = 3


@dataclass
class ErrorInfo:
    """Standard error information"""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    stack_trace: Optional[str] = None
    timestamp: int = field(default_factory=lambda: int(datetime.now().timestamp() * 1000))


@dataclass
class BaseMessage:
    """Base message structure"""
    header: MessageHeader
    payload: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary"""
        return {
            "id": self.header.id,
            "type": self.header.type,
            "timestamp": self.header.timestamp,
            "version": self.header.version,
            "correlationId": self.header.correlation_id,
            "priority": self.header.priority.value,
            "timeout": self.header.timeout,
            "retryCount": self.header.retry_count,
            "maxRetries": self.header.max_retries,
            "payload": self.payload
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseMessage':
        """Create message from dictionary"""
        header = MessageHeader(
            id=data.get("id", str(uuid.uuid4())),
            type=data.get("type", ""),
            timestamp=data.get("timestamp", int(datetime.now().timestamp() * 1000)),
            version=data.get("version", "1.0"),
            correlation_id=data.get("correlationId"),
            priority=Priority(data.get("priority", Priority.NORMAL.value)),
            timeout=data.get("timeout"),
            retry_count=data.get("retryCount", 0),
            max_retries=data.get("maxRetries", 3)
        )
        return cls(header=header, payload=data.get("payload", {}))


@dataclass
class ResponseMessage(BaseMessage):
    """Response message structure"""
    status: MessageStatus = MessageStatus.SUCCESS
    error: Optional[ErrorInfo] = None
    processing_time: Optional[int] = None  # milliseconds
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert response to dictionary"""
        result = super().to_dict()
        result["status"] = self.status.value
        if self.error:
            result["error"] = asdict(self.error)
        if self.processing_time:
            result["processingTime"] = self.processing_time
        return result


# Extraction Protocol Messages

@dataclass
class ExtractionRequest:
    """PDF extraction request payload"""
    file_path: str
    mode: str = "automatic"  # automatic, step-by-step, manual
    options: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None
    fields: Optional[List[str]] = None  # Specific fields to extract
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "file": self.file_path,
            "mode": self.mode,
            "options": self.options,
            "sessionId": self.session_id,
            "fields": self.fields
        }


@dataclass
class ExtractionField:
    """Extracted field information"""
    name: str
    value: Any
    confidence: float
    bbox: Optional[List[float]] = None  # [x, y, width, height]
    page: Optional[int] = None
    validation_status: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "confidence": self.confidence,
            "bbox": self.bbox,
            "page": self.page,
            "validationStatus": self.validation_status
        }


@dataclass
class ExtractionProgress:
    """Extraction progress update"""
    session_id: str
    progress: int  # 0-100
    current_field: Optional[str] = None
    message: str = ""
    fields_completed: int = 0
    fields_total: int = 0
    estimated_time_remaining: Optional[int] = None  # seconds
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "progress": self.progress,
            "currentField": self.current_field,
            "message": self.message,
            "fieldsCompleted": self.fields_completed,
            "fieldsTotal": self.fields_total,
            "estimatedTimeRemaining": self.estimated_time_remaining
        }


@dataclass
class ExtractionResult:
    """Extraction completion result"""
    session_id: str
    fields: List[ExtractionField]
    mode: str
    processing_time: int  # milliseconds
    page_count: int
    warnings: List[str] = field(default_factory=list)
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "fields": [f.to_dict() for f in self.fields],
            "mode": self.mode,
            "processingTime": self.processing_time,
            "pageCount": self.page_count,
            "warnings": self.warnings
        }


# Export Protocol Messages

@dataclass
class ExportRequest:
    """Excel export request payload"""
    session_id: str
    output_path: Optional[str] = None
    format: str = "xlsx"  # xlsx, xls, csv
    options: Dict[str, Any] = field(default_factory=dict)
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "outputPath": self.output_path,
            "format": self.format,
            "options": self.options
        }


@dataclass
class ExportResult:
    """Export completion result"""
    file_path: str
    format: str
    row_count: int
    file_size: int  # bytes
    processing_time: int  # milliseconds
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "filePath": self.file_path,
            "format": self.format,
            "rowCount": self.row_count,
            "fileSize": self.file_size,
            "processingTime": self.processing_time
        }


# File Protocol Messages

@dataclass
class FileChunk:
    """File chunk for large file transfers"""
    session_id: str
    chunk_index: int
    total_chunks: int
    data: bytes
    checksum: str
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "chunkIndex": self.chunk_index,
            "totalChunks": self.total_chunks,
            "data": self.data.hex(),  # Convert bytes to hex string
            "checksum": self.checksum
        }


@dataclass
class FileValidationResult:
    """File validation result"""
    valid: bool
    mime_type: str
    size: int  # bytes
    issues: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_payload(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "mimeType": self.mime_type,
            "size": self.size,
            "issues": self.issues,
            "metadata": self.metadata
        }


# Message Factory

class MessageFactory:
    """Factory for creating standardized messages"""
    
    @staticmethod
    def create_request(msg_type: MessageType, payload: Dict[str, Any], 
                      priority: Priority = Priority.NORMAL,
                      timeout: Optional[int] = None) -> BaseMessage:
        """Create a request message"""
        header = MessageHeader(
            type=msg_type.value,
            priority=priority,
            timeout=timeout
        )
        return BaseMessage(header=header, payload=payload)
    
    @staticmethod
    def create_response(request: BaseMessage, status: MessageStatus,
                       payload: Dict[str, Any], 
                       error: Optional[ErrorInfo] = None) -> ResponseMessage:
        """Create a response message"""
        header = MessageHeader(
            type=f"{request.header.type}.response",
            correlation_id=request.header.id
        )
        
        processing_time = int(datetime.now().timestamp() * 1000) - request.header.timestamp
        
        return ResponseMessage(
            header=header,
            status=status,
            payload=payload,
            error=error,
            processing_time=processing_time
        )
    
    @staticmethod
    def create_progress(msg_type: MessageType, session_id: str,
                       progress_data: Dict[str, Any]) -> BaseMessage:
        """Create a progress message"""
        header = MessageHeader(
            type=msg_type.value,
            priority=Priority.LOW
        )
        payload = {"sessionId": session_id, **progress_data}
        return BaseMessage(header=header, payload=payload)
    
    @staticmethod
    def create_error(request: BaseMessage, error_code: str, 
                    error_message: str, details: Optional[Dict[str, Any]] = None) -> ResponseMessage:
        """Create an error response"""
        error = ErrorInfo(
            code=error_code,
            message=error_message,
            details=details
        )
        return MessageFactory.create_response(
            request, 
            MessageStatus.ERROR,
            {},
            error
        )


# Error Codes

class ErrorCode(Enum):
    """Standard error codes"""
    # System errors
    UNKNOWN_ERROR = "ERR_UNKNOWN"
    INVALID_MESSAGE = "ERR_INVALID_MESSAGE"
    TIMEOUT = "ERR_TIMEOUT"
    RATE_LIMIT = "ERR_RATE_LIMIT"
    
    # Connection errors
    CONNECTION_LOST = "ERR_CONNECTION_LOST"
    CONNECTION_REFUSED = "ERR_CONNECTION_REFUSED"
    
    # File errors
    FILE_NOT_FOUND = "ERR_FILE_NOT_FOUND"
    FILE_ACCESS_DENIED = "ERR_FILE_ACCESS_DENIED"
    FILE_TOO_LARGE = "ERR_FILE_TOO_LARGE"
    INVALID_FILE_FORMAT = "ERR_INVALID_FILE_FORMAT"
    
    # Processing errors
    EXTRACTION_FAILED = "ERR_EXTRACTION_FAILED"
    EXPORT_FAILED = "ERR_EXPORT_FAILED"
    VALIDATION_FAILED = "ERR_VALIDATION_FAILED"
    
    # Resource errors
    MEMORY_LIMIT = "ERR_MEMORY_LIMIT"
    QUEUE_FULL = "ERR_QUEUE_FULL"
    SESSION_NOT_FOUND = "ERR_SESSION_NOT_FOUND"