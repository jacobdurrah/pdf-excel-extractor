"""
Secure file handling operations.
Ensures all files are handled safely with proper validation and cleanup.
"""

import os
import hashlib
import tempfile
import shutil
from pathlib import Path
from typing import Optional, BinaryIO
from datetime import datetime, timedelta
import threading
import time
from contextlib import contextmanager

from ..models import SecurityConfig


class SecureFileHandler:
    """Handles all file operations securely."""
    
    def __init__(self, security_config: Optional[SecurityConfig] = None):
        self.config = security_config or SecurityConfig()
        self.temp_dir = Path(tempfile.gettempdir()) / "pdf_extractor_secure"
        self.temp_dir.mkdir(exist_ok=True, mode=0o700)
        self.active_files = {}
        self._cleanup_thread = threading.Thread(target=self._cleanup_worker, daemon=True)
        self._cleanup_thread.start()
    
    def get_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def validate_file(self, file_path: Path) -> tuple[bool, str]:
        """
        Validate a file for security requirements.
        Returns (is_valid, error_message)
        """
        # Check file existence
        if not file_path.exists():
            return False, "File does not exist"
        
        # Check file size
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        if file_size_mb > self.config.max_file_size_mb:
            return False, f"File exceeds maximum size of {self.config.max_file_size_mb}MB"
        
        # Check file extension
        if file_path.suffix.lower() not in self.config.allowed_extensions:
            return False, f"File type {file_path.suffix} not allowed"
        
        # Check if file is actually a PDF (magic bytes)
        with open(file_path, 'rb') as f:
            header = f.read(4)
            if header != b'%PDF':
                return False, "File is not a valid PDF"
        
        return True, ""
    
    @contextmanager
    def secure_temp_file(self, suffix: str = ".pdf"):
        """
        Context manager for secure temporary file handling.
        Ensures cleanup even on exceptions.
        """
        temp_file = None
        try:
            # Create temp file in our secure directory
            fd, temp_path = tempfile.mkstemp(suffix=suffix, dir=self.temp_dir)
            os.close(fd)  # Close the file descriptor
            temp_file = Path(temp_path)
            
            # Set restrictive permissions
            os.chmod(temp_file, 0o600)
            
            # Track for cleanup
            self.active_files[str(temp_file)] = datetime.now()
            
            yield temp_file
            
        finally:
            # Cleanup
            if temp_file and temp_file.exists():
                self.secure_delete(temp_file)
                self.active_files.pop(str(temp_file), None)
    
    def secure_delete(self, file_path: Path, passes: Optional[int] = None):
        """
        Securely delete a file by overwriting it multiple times.
        """
        if not file_path.exists():
            return
        
        passes = passes or self.config.secure_delete_passes
        file_size = file_path.stat().st_size
        
        try:
            with open(file_path, "ba+", buffering=0) as f:
                for _ in range(passes):
                    f.seek(0)
                    f.write(os.urandom(file_size))
                    f.flush()
                    os.fsync(f.fileno())
        finally:
            file_path.unlink()
    
    def copy_to_secure_location(self, source_path: Path) -> Path:
        """
        Copy a file to secure temporary location.
        Returns path to the secure copy.
        """
        # Validate source file
        is_valid, error = self.validate_file(source_path)
        if not is_valid:
            raise ValueError(f"Invalid file: {error}")
        
        # Create secure copy
        secure_path = self.temp_dir / f"{datetime.now().timestamp()}_{source_path.name}"
        shutil.copy2(source_path, secure_path)
        os.chmod(secure_path, 0o600)
        
        # Track for cleanup
        self.active_files[str(secure_path)] = datetime.now()
        
        return secure_path
    
    def _cleanup_worker(self):
        """Background worker to clean up old temporary files."""
        while True:
            try:
                current_time = datetime.now()
                files_to_clean = []
                
                # Check tracked files
                for file_path, created_time in self.active_files.items():
                    age = (current_time - created_time).total_seconds()
                    if age > self.config.temp_file_lifetime_seconds:
                        files_to_clean.append(file_path)
                
                # Clean up old files
                for file_path in files_to_clean:
                    path = Path(file_path)
                    if path.exists():
                        self.secure_delete(path)
                    self.active_files.pop(file_path, None)
                
                # Also check temp directory for orphaned files
                if self.temp_dir.exists():
                    for file_path in self.temp_dir.iterdir():
                        if file_path.is_file():
                            age = current_time.timestamp() - file_path.stat().st_mtime
                            if age > self.config.temp_file_lifetime_seconds:
                                self.secure_delete(file_path)
                
            except Exception:
                # Silently continue on errors
                pass
            
            # Sleep for 5 minutes between cleanups
            time.sleep(300)
    
    def cleanup_all(self):
        """Clean up all temporary files immediately."""
        for file_path in list(self.active_files.keys()):
            path = Path(file_path)
            if path.exists():
                self.secure_delete(path)
            self.active_files.pop(file_path, None)