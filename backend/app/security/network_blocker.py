"""
Network blocking utilities to ensure all processing stays local.
Prevents any external network connections.
"""

import socket
import ssl
import urllib3
import requests
from typing import Any, Optional
from functools import wraps
from datetime import datetime


class NetworkBlocker:
    """Blocks all network requests to ensure local-only processing."""
    
    _original_socket = None
    _original_ssl_wrap = None
    _original_urllib3 = None
    _original_requests = None
    _is_blocked = False
    
    @classmethod
    def block_all_network(cls):
        """Block all network connections."""
        if cls._is_blocked:
            return
        
        # Save original functions
        cls._original_socket = socket.socket
        cls._original_ssl_wrap = ssl.wrap_socket
        
        # Block socket connections
        def blocked_socket(*args, **kwargs):
            raise BlockedNetworkError(
                "Network access is blocked for security. All processing must be local."
            )
        
        # Block SSL connections
        def blocked_ssl_wrap(*args, **kwargs):
            raise BlockedNetworkError(
                "SSL connections are blocked for security. All processing must be local."
            )
        
        # Apply blocks
        socket.socket = blocked_socket
        ssl.wrap_socket = blocked_ssl_wrap
        
        # Block urllib3
        try:
            import urllib3.connection
            cls._original_urllib3 = urllib3.connection.HTTPConnection.connect
            
            def blocked_urllib3_connect(self):
                raise BlockedNetworkError(
                    "HTTP connections are blocked for security. All processing must be local."
                )
            
            urllib3.connection.HTTPConnection.connect = blocked_urllib3_connect
            urllib3.connection.HTTPSConnection.connect = blocked_urllib3_connect
        except ImportError:
            pass
        
        # Block requests
        try:
            import requests.adapters
            cls._original_requests = requests.adapters.HTTPAdapter.send
            
            def blocked_requests_send(self, request, *args, **kwargs):
                raise BlockedNetworkError(
                    "HTTP requests are blocked for security. All processing must be local."
                )
            
            requests.adapters.HTTPAdapter.send = blocked_requests_send
        except ImportError:
            pass
        
        cls._is_blocked = True
    
    @classmethod
    def unblock_all_network(cls):
        """Restore network connections (for testing only)."""
        if not cls._is_blocked:
            return
        
        # Restore socket
        if cls._original_socket:
            socket.socket = cls._original_socket
        
        # Restore SSL
        if cls._original_ssl_wrap:
            ssl.wrap_socket = cls._original_ssl_wrap
        
        # Restore urllib3
        if cls._original_urllib3:
            try:
                import urllib3.connection
                urllib3.connection.HTTPConnection.connect = cls._original_urllib3
                urllib3.connection.HTTPSConnection.connect = cls._original_urllib3
            except ImportError:
                pass
        
        # Restore requests
        if cls._original_requests:
            try:
                import requests.adapters
                requests.adapters.HTTPAdapter.send = cls._original_requests
            except ImportError:
                pass
        
        cls._is_blocked = False
    
    @classmethod
    def is_blocked(cls) -> bool:
        """Check if network is currently blocked."""
        return cls._is_blocked


class BlockedNetworkError(Exception):
    """Raised when network access is attempted while blocked."""
    pass


def ensure_local_only(func):
    """
    Decorator to ensure function runs with network blocked.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        was_blocked = NetworkBlocker.is_blocked()
        
        if not was_blocked:
            NetworkBlocker.block_all_network()
        
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            # Only unblock if it wasn't blocked before
            if not was_blocked:
                NetworkBlocker.unblock_all_network()
    
    return wrapper


class NetworkMonitor:
    """Monitor for any network connection attempts."""
    
    def __init__(self):
        self.attempts = []
    
    def log_attempt(self, description: str, details: Optional[dict] = None):
        """Log a network attempt."""
        self.attempts.append({
            'description': description,
            'details': details or {},
            'timestamp': datetime.now()
        })
    
    def get_attempts(self) -> list:
        """Get all logged network attempts."""
        return self.attempts.copy()
    
    def clear(self):
        """Clear logged attempts."""
        self.attempts.clear()


# Auto-block on import for security
NetworkBlocker.block_all_network()