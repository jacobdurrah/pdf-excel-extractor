"""
Unified security wrapper for easy integration by other agents.
Provides a simple interface to all security features.
"""

from pathlib import Path
from typing import Optional, Dict, Any, Callable
from contextlib import contextmanager
import uuid

from .file_handler import SecureFileHandler
from .memory_manager import MemoryManager
from .audit_logger import AuditLogger, AuditAction, AuditContext
from .encryption import SessionEncryptor
from .validators import SecurityValidator
from .network_blocker import ensure_local_only
from ..models import SecurityConfig


class SecurityWrapper:
    """
    Unified security interface for all agents.
    Provides simple methods for common security operations.
    """
    
    def __init__(self, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
        self.file_handler = SecureFileHandler(self.config)
        self.memory_manager = MemoryManager(self.config)
        self.audit_logger = AuditLogger(config=self.config)
        self.session_encryptor = SessionEncryptor()
        self.validator = SecurityValidator
        
        # Start memory monitoring
        self.memory_manager.start_monitoring()
        
        # Session management
        self.sessions = {}
    
    def create_session(self, user_id: Optional[str] = None) -> str:
        """Create a new secure session."""
        session_id = str(uuid.uuid4())
        user_id = user_id or f"user_{session_id[:8]}"
        
        self.sessions[session_id] = {
            'user_id': user_id,
            'encryptor': self.session_encryptor.create_session(session_id)
        }
        
        self.audit_logger.log(
            action=AuditAction.SECURITY,
            user_id=user_id,
            details={'event': 'session_created', 'session_id': session_id}
        )
        
        return session_id
    
    def end_session(self, session_id: str):
        """End a session and cleanup resources."""
        if session_id in self.sessions:
            user_id = self.sessions[session_id]['user_id']
            self.session_encryptor.end_session(session_id)
            del self.sessions[session_id]
            
            self.audit_logger.log(
                action=AuditAction.SECURITY,
                user_id=user_id,
                details={'event': 'session_ended', 'session_id': session_id}
            )
    
    @contextmanager
    def secure_file_operation(self, session_id: str, file_path: Path, action: str):
        """
        Context manager for secure file operations.
        Handles validation, audit logging, and cleanup.
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Invalid session ID")
        
        user_id = session['user_id']
        file_hash = None
        
        try:
            # Validate file
            is_valid, error = self.file_handler.validate_file(file_path)
            if not is_valid:
                raise ValueError(f"File validation failed: {error}")
            
            # Get file hash for audit
            file_hash = self.file_handler.get_file_hash(file_path)
            
            # Copy to secure location
            secure_path = self.file_handler.copy_to_secure_location(file_path)
            
            # Start audit context
            with AuditContext(
                self.audit_logger,
                AuditAction(action),
                user_id,
                file_hash
            ) as audit:
                yield secure_path
                
        finally:
            # Cleanup is handled by file_handler
            pass
    
    @contextmanager
    def memory_limited_operation(self, max_mb: Optional[float] = None):
        """Context manager for memory-limited operations."""
        with self.memory_manager.create_memory_context(max_mb) as ctx:
            yield ctx
    
    @ensure_local_only
    def process_with_security(
        self,
        session_id: str,
        file_path: Path,
        process_func: Callable[[Path], Any],
        action: str = "process"
    ) -> Any:
        """
        Process a file with full security measures.
        This is the main method other agents should use.
        """
        with self.secure_file_operation(session_id, file_path, action) as secure_path:
            with self.memory_limited_operation():
                # Process the file
                result = process_func(secure_path)
                
                # Validate output if it's extraction data
                if isinstance(result, dict) and 'fields' in result:
                    is_valid, error = self.validator.validate_extraction_data(result)
                    if not is_valid:
                        raise ValueError(f"Invalid extraction data: {error}")
                
                return result
    
    def validate_input(self, data: Any, input_type: str) -> tuple[bool, Any]:
        """
        Validate various types of input.
        Returns (is_valid, sanitized_data_or_error)
        """
        if input_type == "filename":
            return self.validator.validate_filename(data)
        elif input_type == "path":
            return self.validator.validate_path(data)
        elif input_type == "json":
            return self.validator.validate_json(data)
        elif input_type == "string":
            return True, self.validator.sanitize_string(data)
        else:
            return False, f"Unknown input type: {input_type}"
    
    def check_sensitive_data(self, text: str) -> Dict[str, Any]:
        """Check and optionally mask sensitive data."""
        detected = self.validator.contains_sensitive_data(text)
        masked = self.validator.mask_sensitive_data(text) if detected else text
        
        return {
            'has_sensitive_data': bool(detected),
            'detected_types': detected,
            'masked_text': masked
        }
    
    def get_security_status(self) -> Dict[str, Any]:
        """Get current security status."""
        memory_usage = self.memory_manager.get_memory_usage_mb()
        memory_percent = self.memory_manager.get_memory_percent()
        
        return {
            'memory_usage_mb': memory_usage,
            'memory_percent': memory_percent,
            'active_sessions': len(self.sessions),
            'network_blocked': True,  # Always true
            'audit_stats': self.audit_logger.get_statistics()
        }
    
    def cleanup_all(self):
        """Cleanup all resources."""
        # End all sessions
        for session_id in list(self.sessions.keys()):
            self.end_session(session_id)
        
        # Cleanup files
        self.file_handler.cleanup_all()
        
        # Force memory cleanup
        self.memory_manager.force_cleanup()
        
        # Stop monitoring
        self.memory_manager.stop_monitoring()


# Global security instance for easy access
_global_security = None


def get_security() -> SecurityWrapper:
    """Get the global security wrapper instance."""
    global _global_security
    if _global_security is None:
        _global_security = SecurityWrapper()
    return _global_security


def init_security(config: Optional[SecurityConfig] = None) -> SecurityWrapper:
    """Initialize the global security wrapper with config."""
    global _global_security
    _global_security = SecurityWrapper(config)
    return _global_security