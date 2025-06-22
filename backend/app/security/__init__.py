"""
Security module for PDF to Excel Extractor.
Ensures all processing stays local and secure.
"""

from .file_handler import SecureFileHandler
from .memory_manager import MemoryManager
from .audit_logger import AuditLogger, AuditAction, AuditContext
from .encryption import Encryptor, SessionEncryptor
from .validators import SecurityValidator
from .network_blocker import NetworkBlocker, ensure_local_only
from .security_wrapper import SecurityWrapper, get_security, init_security

# Auto-block network on import
NetworkBlocker.block_all_network()

__all__ = [
    'SecureFileHandler',
    'MemoryManager', 
    'AuditLogger',
    'AuditAction',
    'AuditContext',
    'Encryptor',
    'SessionEncryptor',
    'SecurityValidator',
    'NetworkBlocker',
    'ensure_local_only',
    'SecurityWrapper',
    'get_security',
    'init_security'
]