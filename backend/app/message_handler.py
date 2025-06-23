"""
Enhanced message handler with routing, validation, and error handling
"""

import asyncio
import logging
from typing import Dict, Any, Callable, Optional, List
from datetime import datetime
import traceback
from functools import wraps

from .protocols import (
    BaseMessage,
    ResponseMessage,
    MessageFactory,
    MessageType,
    MessageStatus,
    ErrorCode,
    ErrorInfo,
    ExtractionRequest,
    ExtractionProgress,
    ExtractionResult,
    ExportRequest,
    ExportResult,
    FileValidationResult
)

logger = logging.getLogger(__name__)


class MessageHandler:
    """Central message handler with routing and processing logic"""
    
    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self.middleware: List[Callable] = []
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.stats = {
            'messages_received': 0,
            'messages_processed': 0,
            'messages_failed': 0,
            'processing_time_total': 0
        }
        
        # Register default handlers
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """Register built-in message handlers"""
        self.register(MessageType.PING.value, self._handle_ping)
        self.register(MessageType.SHUTDOWN.value, self._handle_shutdown)
        self.register(MessageType.SESSION_CREATE.value, self._handle_session_create)
        self.register(MessageType.SESSION_UPDATE.value, self._handle_session_update)
        self.register(MessageType.SESSION_DELETE.value, self._handle_session_delete)
        self.register(MessageType.SESSION_LIST.value, self._handle_session_list)
    
    def register(self, message_type: str, handler: Callable):
        """Register a message handler"""
        self.handlers[message_type] = handler
        logger.info(f"Registered handler for message type: {message_type}")
    
    def use_middleware(self, middleware: Callable):
        """Add middleware for message processing"""
        self.middleware.append(middleware)
    
    async def process_message(self, message_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Process an incoming message"""
        start_time = datetime.now()
        self.stats['messages_received'] += 1
        
        try:
            # Parse message
            message = BaseMessage.from_dict(message_data)
            
            # Apply middleware
            for mw in self.middleware:
                result = await self._apply_middleware(mw, message)
                if result is False:
                    return None  # Middleware rejected message
            
            # Get handler
            handler = self.handlers.get(message.header.type)
            if not handler:
                raise ValueError(f"No handler registered for message type: {message.header.type}")
            
            # Execute handler
            response = await self._execute_handler(handler, message)
            
            # Update stats
            self.stats['messages_processed'] += 1
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            self.stats['processing_time_total'] += processing_time
            
            if isinstance(response, ResponseMessage):
                response.processing_time = int(processing_time)
            
            return response.to_dict() if response else None
            
        except Exception as e:
            logger.error(f"Message processing error: {str(e)}\n{traceback.format_exc()}")
            self.stats['messages_failed'] += 1
            
            # Create error response
            error_response = MessageFactory.create_error(
                BaseMessage.from_dict(message_data),
                ErrorCode.UNKNOWN_ERROR.value,
                str(e),
                {'traceback': traceback.format_exc()}
            )
            
            return error_response.to_dict()
    
    async def _apply_middleware(self, middleware: Callable, message: BaseMessage) -> bool:
        """Apply middleware to message"""
        try:
            result = await middleware(message) if asyncio.iscoroutinefunction(middleware) else middleware(message)
            return result is not False
        except Exception as e:
            logger.error(f"Middleware error: {str(e)}")
            return False
    
    async def _execute_handler(self, handler: Callable, message: BaseMessage) -> Optional[ResponseMessage]:
        """Execute a message handler"""
        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(message)
            else:
                result = handler(message)
            
            # If handler returns a dict, wrap it in a response
            if isinstance(result, dict):
                return MessageFactory.create_response(
                    message,
                    MessageStatus.SUCCESS,
                    result
                )
            
            return result
            
        except Exception as e:
            logger.error(f"Handler error: {str(e)}\n{traceback.format_exc()}")
            raise
    
    # Built-in handlers
    
    async def _handle_ping(self, message: BaseMessage) -> ResponseMessage:
        """Handle ping message"""
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            {'timestamp': int(datetime.now().timestamp() * 1000)}
        )
    
    async def _handle_shutdown(self, message: BaseMessage) -> ResponseMessage:
        """Handle shutdown message"""
        logger.info("Shutdown requested via message")
        
        # Schedule shutdown after response
        asyncio.create_task(self._delayed_shutdown())
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            {'message': 'Shutting down'}
        )
    
    async def _delayed_shutdown(self):
        """Delayed shutdown to allow response to be sent"""
        await asyncio.sleep(1)
        raise KeyboardInterrupt("Shutdown requested")
    
    async def _handle_session_create(self, message: BaseMessage) -> ResponseMessage:
        """Create a new session"""
        session_id = f"session-{int(datetime.now().timestamp())}"
        session_data = {
            'id': session_id,
            'created_at': datetime.now().isoformat(),
            'status': 'active',
            **message.payload
        }
        
        self.sessions[session_id] = session_data
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            session_data
        )
    
    async def _handle_session_update(self, message: BaseMessage) -> ResponseMessage:
        """Update existing session"""
        session_id = message.payload.get('sessionId')
        if not session_id or session_id not in self.sessions:
            return MessageFactory.create_error(
                message,
                ErrorCode.SESSION_NOT_FOUND.value,
                f"Session not found: {session_id}"
            )
        
        # Update session data
        self.sessions[session_id].update(message.payload.get('data', {}))
        self.sessions[session_id]['updated_at'] = datetime.now().isoformat()
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            self.sessions[session_id]
        )
    
    async def _handle_session_delete(self, message: BaseMessage) -> ResponseMessage:
        """Delete a session"""
        session_id = message.payload.get('sessionId')
        if not session_id or session_id not in self.sessions:
            return MessageFactory.create_error(
                message,
                ErrorCode.SESSION_NOT_FOUND.value,
                f"Session not found: {session_id}"
            )
        
        deleted_session = self.sessions.pop(session_id)
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            {'deleted': True, 'session': deleted_session}
        )
    
    async def _handle_session_list(self, message: BaseMessage) -> ResponseMessage:
        """List all sessions"""
        sessions_list = list(self.sessions.values())
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            {'sessions': sessions_list, 'count': len(sessions_list)}
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get handler statistics"""
        avg_processing_time = (
            self.stats['processing_time_total'] / self.stats['messages_processed']
            if self.stats['messages_processed'] > 0
            else 0
        )
        
        return {
            **self.stats,
            'average_processing_time': avg_processing_time,
            'active_sessions': len(self.sessions),
            'registered_handlers': len(self.handlers)
        }


class ExtractorMessageHandler(MessageHandler):
    """Extended message handler with PDF extraction support"""
    
    def __init__(self, pdf_processor=None, excel_exporter=None):
        super().__init__()
        self.pdf_processor = pdf_processor
        self.excel_exporter = excel_exporter
        
        # Register extraction handlers
        self.register(MessageType.EXTRACTION_PROCESS.value, self._handle_extraction)
        self.register(MessageType.EXTRACTION_CANCEL.value, self._handle_extraction_cancel)
        self.register(MessageType.EXPORT_EXCEL.value, self._handle_export)
        self.register(MessageType.FILE_VALIDATE.value, self._handle_file_validate)
    
    async def _handle_extraction(self, message: BaseMessage) -> ResponseMessage:
        """Handle PDF extraction request"""
        try:
            # Parse request
            req = ExtractionRequest(
                file_path=message.payload.get('file'),
                mode=message.payload.get('mode', 'automatic'),
                options=message.payload.get('options', {}),
                session_id=message.payload.get('sessionId'),
                fields=message.payload.get('fields')
            )
            
            # Create session
            session_id = req.session_id or f"session-{int(datetime.now().timestamp())}"
            self.sessions[session_id] = {
                'id': session_id,
                'type': 'extraction',
                'status': 'processing',
                'file_path': req.file_path,
                'mode': req.mode,
                'started_at': datetime.now().isoformat()
            }
            
            # Mock extraction for now
            # TODO: Integrate with actual PDF processor
            await self._simulate_extraction_progress(session_id)
            
            # Create mock result
            fields = [
                {
                    'name': 'check_number',
                    'value': '12345',
                    'confidence': 0.95,
                    'bbox': [100, 100, 200, 120],
                    'page': 1
                },
                {
                    'name': 'date',
                    'value': '2024-01-15',
                    'confidence': 0.98,
                    'bbox': [300, 100, 400, 120],
                    'page': 1
                },
                {
                    'name': 'amount',
                    'value': '1,234.56',
                    'confidence': 0.92,
                    'bbox': [500, 100, 600, 120],
                    'page': 1
                }
            ]
            
            # Update session
            self.sessions[session_id].update({
                'status': 'completed',
                'completed_at': datetime.now().isoformat(),
                'fields': fields
            })
            
            # Create result
            result = ExtractionResult(
                session_id=session_id,
                fields=[],  # Would be populated from actual extraction
                mode=req.mode,
                processing_time=2000,  # Mock 2 seconds
                page_count=1,
                warnings=[]
            )
            
            return MessageFactory.create_response(
                message,
                MessageStatus.SUCCESS,
                {
                    'sessionId': session_id,
                    'fields': fields,
                    'mode': req.mode,
                    'processingTime': 2000,
                    'pageCount': 1
                }
            )
            
        except Exception as e:
            logger.error(f"Extraction error: {str(e)}")
            return MessageFactory.create_error(
                message,
                ErrorCode.EXTRACTION_FAILED.value,
                str(e)
            )
    
    async def _simulate_extraction_progress(self, session_id: str):
        """Simulate extraction progress events"""
        # This would be replaced with actual progress from PDF processor
        progress_steps = [
            (25, 'check_number', 'Extracting check number...'),
            (50, 'date', 'Extracting date...'),
            (75, 'amount', 'Extracting amount...'),
            (100, None, 'Extraction complete')
        ]
        
        for progress, field, message_text in progress_steps:
            await asyncio.sleep(0.5)  # Simulate processing time
            
            # In real implementation, this would send progress via IPC
            logger.info(f"Extraction progress: {progress}% - {message_text}")
    
    async def _handle_extraction_cancel(self, message: BaseMessage) -> ResponseMessage:
        """Handle extraction cancellation"""
        session_id = message.payload.get('sessionId')
        
        if session_id not in self.sessions:
            return MessageFactory.create_error(
                message,
                ErrorCode.SESSION_NOT_FOUND.value,
                f"Session not found: {session_id}"
            )
        
        # Update session status
        self.sessions[session_id]['status'] = 'cancelled'
        self.sessions[session_id]['cancelled_at'] = datetime.now().isoformat()
        
        # TODO: Actually cancel the extraction process
        
        return MessageFactory.create_response(
            message,
            MessageStatus.SUCCESS,
            {'sessionId': session_id, 'cancelled': True}
        )
    
    async def _handle_export(self, message: BaseMessage) -> ResponseMessage:
        """Handle Excel export request"""
        try:
            req = ExportRequest(
                session_id=message.payload.get('sessionId'),
                output_path=message.payload.get('outputPath'),
                format=message.payload.get('format', 'xlsx'),
                options=message.payload.get('options', {})
            )
            
            # Get session data
            if req.session_id not in self.sessions:
                return MessageFactory.create_error(
                    message,
                    ErrorCode.SESSION_NOT_FOUND.value,
                    f"Session not found: {req.session_id}"
                )
            
            session = self.sessions[req.session_id]
            
            # Mock export
            # TODO: Integrate with actual Excel exporter
            output_path = req.output_path or f"/tmp/export-{req.session_id}.{req.format}"
            
            result = ExportResult(
                file_path=output_path,
                format=req.format,
                row_count=len(session.get('fields', [])),
                file_size=25600,  # Mock size
                processing_time=500  # Mock 500ms
            )
            
            return MessageFactory.create_response(
                message,
                MessageStatus.SUCCESS,
                result.to_payload()
            )
            
        except Exception as e:
            logger.error(f"Export error: {str(e)}")
            return MessageFactory.create_error(
                message,
                ErrorCode.EXPORT_FAILED.value,
                str(e)
            )
    
    async def _handle_file_validate(self, message: BaseMessage) -> ResponseMessage:
        """Handle file validation request"""
        try:
            file_path = message.payload.get('path')
            
            # Mock validation
            # TODO: Integrate with actual file validator
            result = FileValidationResult(
                valid=True,
                mime_type='application/pdf',
                size=1024000,  # 1MB
                issues=[],
                metadata={'pages': 1, 'encrypted': False}
            )
            
            return MessageFactory.create_response(
                message,
                MessageStatus.SUCCESS,
                result.to_payload()
            )
            
        except Exception as e:
            logger.error(f"Validation error: {str(e)}")
            return MessageFactory.create_error(
                message,
                ErrorCode.VALIDATION_FAILED.value,
                str(e)
            )


# Middleware examples

def logging_middleware(message: BaseMessage) -> bool:
    """Log all incoming messages"""
    logger.debug(f"Incoming message: {message.header.type} (ID: {message.header.id})")
    return True


def rate_limit_middleware(max_requests: int = 100, window_seconds: int = 60):
    """Rate limiting middleware"""
    requests = []
    
    def middleware(message: BaseMessage) -> bool:
        now = datetime.now().timestamp()
        
        # Remove old requests outside the window
        while requests and requests[0] < now - window_seconds:
            requests.pop(0)
        
        # Check rate limit
        if len(requests) >= max_requests:
            logger.warning(f"Rate limit exceeded for message {message.header.id}")
            return False
        
        requests.append(now)
        return True
    
    return middleware


def auth_middleware(required_token: str):
    """Authentication middleware"""
    def middleware(message: BaseMessage) -> bool:
        token = message.payload.get('auth_token')
        if token != required_token:
            logger.warning(f"Authentication failed for message {message.header.id}")
            return False
        return True
    
    return middleware