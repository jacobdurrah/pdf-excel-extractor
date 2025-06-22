"""
Memory management utilities to prevent memory leaks and enforce limits.
"""

import os
import gc
import psutil
import threading
from typing import Optional, Callable
from functools import wraps
import warnings

from ..models import SecurityConfig


class MemoryManager:
    """Manages memory usage and cleanup."""
    
    def __init__(self, security_config: Optional[SecurityConfig] = None):
        self.config = security_config or SecurityConfig()
        self.process = psutil.Process(os.getpid())
        self._memory_limit_mb = self.config.memory_limit_mb
        self._monitor_thread = None
        self._monitoring = False
        self._callbacks = []
    
    def get_memory_usage_mb(self) -> float:
        """Get current memory usage in MB."""
        return self.process.memory_info().rss / (1024 * 1024)
    
    def get_memory_percent(self) -> float:
        """Get memory usage as percentage of limit."""
        current_mb = self.get_memory_usage_mb()
        return (current_mb / self._memory_limit_mb) * 100
    
    def check_memory_limit(self) -> tuple[bool, float]:
        """
        Check if memory usage is within limits.
        Returns (is_within_limit, current_usage_mb)
        """
        current_mb = self.get_memory_usage_mb()
        return current_mb < self._memory_limit_mb, current_mb
    
    def force_cleanup(self):
        """Force garbage collection and memory cleanup."""
        # Clear any caches
        gc.collect()
        
        # Force full collection
        for _ in range(3):
            gc.collect(2)
    
    def memory_limited(self, func: Callable) -> Callable:
        """
        Decorator to enforce memory limits on functions.
        Raises MemoryError if limit exceeded.
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Check memory before execution
            within_limit, current_mb = self.check_memory_limit()
            if not within_limit:
                self.force_cleanup()
                within_limit, current_mb = self.check_memory_limit()
                if not within_limit:
                    raise MemoryError(
                        f"Memory limit exceeded: {current_mb:.1f}MB / {self._memory_limit_mb}MB"
                    )
            
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                # Cleanup after execution if memory usage is high
                if self.get_memory_percent() > 80:
                    self.force_cleanup()
        
        return wrapper
    
    def start_monitoring(self, interval_seconds: int = 10):
        """Start background memory monitoring."""
        if self._monitoring:
            return
        
        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_worker,
            args=(interval_seconds,),
            daemon=True
        )
        self._monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop background memory monitoring."""
        self._monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=1)
    
    def add_warning_callback(self, callback: Callable[[float], None]):
        """Add callback for memory warnings."""
        self._callbacks.append(callback)
    
    def _monitor_worker(self, interval: int):
        """Background worker for memory monitoring."""
        warning_threshold = self._memory_limit_mb * 0.8
        critical_threshold = self._memory_limit_mb * 0.95
        
        while self._monitoring:
            try:
                current_mb = self.get_memory_usage_mb()
                
                # Check thresholds
                if current_mb > critical_threshold:
                    # Force cleanup on critical
                    self.force_cleanup()
                    warnings.warn(
                        f"Critical memory usage: {current_mb:.1f}MB / {self._memory_limit_mb}MB",
                        ResourceWarning
                    )
                    
                    # Notify callbacks
                    for callback in self._callbacks:
                        try:
                            callback(current_mb)
                        except Exception:
                            pass
                            
                elif current_mb > warning_threshold:
                    warnings.warn(
                        f"High memory usage: {current_mb:.1f}MB / {self._memory_limit_mb}MB",
                        ResourceWarning
                    )
                
            except Exception:
                pass
            
            # Sleep for interval
            threading.Event().wait(interval)
    
    def create_memory_context(self, max_mb: Optional[float] = None):
        """
        Create a context manager with specific memory limit.
        """
        return MemoryContext(self, max_mb)


class MemoryContext:
    """Context manager for memory-limited operations."""
    
    def __init__(self, manager: MemoryManager, max_mb: Optional[float] = None):
        self.manager = manager
        self.max_mb = max_mb or manager._memory_limit_mb
        self.original_limit = manager._memory_limit_mb
        self.start_memory = 0
    
    def __enter__(self):
        self.start_memory = self.manager.get_memory_usage_mb()
        self.manager._memory_limit_mb = self.max_mb
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore original limit
        self.manager._memory_limit_mb = self.original_limit
        
        # Force cleanup
        self.manager.force_cleanup()
        
        # Log memory delta
        end_memory = self.manager.get_memory_usage_mb()
        delta = end_memory - self.start_memory
        if delta > 10:  # More than 10MB increase
            warnings.warn(f"Operation increased memory by {delta:.1f}MB", ResourceWarning)