"""
Input validation and sanitization utilities.
Ensures all inputs are safe and prevents injection attacks.
"""

import re
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import json
from urllib.parse import urlparse
import mimetypes


class SecurityValidator:
    """Validates and sanitizes all inputs for security."""
    
    # Patterns for detecting potentially sensitive data
    SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
    CREDIT_CARD_PATTERN = re.compile(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b')
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN = re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b')
    
    # Dangerous path components
    DANGEROUS_PATH_PARTS = ['..', '~', '$', '|', '>', '<', '&', ';', '`', '\n', '\r']
    
    # Maximum sizes
    MAX_STRING_LENGTH = 10000
    MAX_FILENAME_LENGTH = 255
    MAX_PATH_LENGTH = 4096
    
    @classmethod
    def validate_filename(cls, filename: str) -> tuple[bool, str]:
        """
        Validate a filename for security issues.
        Returns (is_valid, sanitized_filename)
        """
        # Check length
        if len(filename) > cls.MAX_FILENAME_LENGTH:
            return False, "Filename too long"
        
        # Check for null bytes
        if '\x00' in filename:
            return False, "Null bytes not allowed"
        
        # Sanitize filename
        # Remove any path separators
        filename = os.path.basename(filename)
        
        # Remove dangerous characters
        sanitized = re.sub(r'[^\w\s.-]', '_', filename)
        
        # Ensure it has a proper extension
        if '.' not in sanitized:
            return False, "No file extension"
        
        # Check for double extensions (potential attack)
        parts = sanitized.split('.')
        if len(parts) > 2 and parts[-2].lower() in ['pdf', 'exe', 'bat', 'cmd', 'sh']:
            return False, "Suspicious double extension"
        
        return True, sanitized
    
    @classmethod
    def validate_path(cls, path: Union[str, Path]) -> tuple[bool, str]:
        """
        Validate a file path for security issues.
        Returns (is_valid, error_message)
        """
        path_str = str(path)
        
        # Check length
        if len(path_str) > cls.MAX_PATH_LENGTH:
            return False, "Path too long"
        
        # Check for dangerous components
        for dangerous in cls.DANGEROUS_PATH_PARTS:
            if dangerous in path_str:
                return False, f"Dangerous path component: {dangerous}"
        
        # Check for null bytes
        if '\x00' in path_str:
            return False, "Null bytes not allowed in path"
        
        # Ensure absolute path
        try:
            abs_path = Path(path_str).resolve()
            
            # Check if trying to access system directories
            system_dirs = ['/etc', '/sys', '/proc', 'C:\\Windows', 'C:\\System32']
            for sys_dir in system_dirs:
                if str(abs_path).startswith(sys_dir):
                    return False, "Access to system directories not allowed"
            
        except Exception:
            return False, "Invalid path"
        
        return True, ""
    
    @classmethod
    def sanitize_string(cls, text: str, max_length: Optional[int] = None) -> str:
        """Sanitize a string by removing dangerous characters."""
        max_length = max_length or cls.MAX_STRING_LENGTH
        
        # Truncate if too long
        text = text[:max_length]
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        # Remove control characters except newlines and tabs
        text = re.sub(r'[\x01-\x08\x0b-\x0c\x0e-\x1f\x7f]', '', text)
        
        return text
    
    @classmethod
    def validate_json(cls, data: Union[str, dict]) -> tuple[bool, Any]:
        """
        Validate JSON data.
        Returns (is_valid, parsed_data_or_error)
        """
        try:
            if isinstance(data, str):
                parsed = json.loads(data)
            else:
                parsed = data
            
            # Check for deeply nested structures (potential DoS)
            def check_depth(obj, depth=0, max_depth=10):
                if depth > max_depth:
                    return False
                if isinstance(obj, dict):
                    return all(check_depth(v, depth + 1) for v in obj.values())
                elif isinstance(obj, list):
                    return all(check_depth(item, depth + 1) for item in obj)
                return True
            
            if not check_depth(parsed):
                return False, "JSON too deeply nested"
            
            return True, parsed
            
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON: {str(e)}"
        except Exception as e:
            return False, f"JSON validation error: {str(e)}"
    
    @classmethod
    def contains_sensitive_data(cls, text: str) -> List[str]:
        """
        Check if text contains potentially sensitive data.
        Returns list of detected sensitive data types.
        """
        detected = []
        
        if cls.SSN_PATTERN.search(text):
            detected.append("SSN")
        if cls.CREDIT_CARD_PATTERN.search(text):
            detected.append("Credit Card")
        if cls.EMAIL_PATTERN.search(text):
            detected.append("Email")
        if cls.PHONE_PATTERN.search(text):
            detected.append("Phone Number")
        
        return detected
    
    @classmethod
    def mask_sensitive_data(cls, text: str) -> str:
        """Mask potentially sensitive data in text."""
        # Mask SSNs
        text = cls.SSN_PATTERN.sub('XXX-XX-XXXX', text)
        
        # Mask credit cards
        text = cls.CREDIT_CARD_PATTERN.sub('XXXX-XXXX-XXXX-XXXX', text)
        
        # Mask emails (keep domain)
        def mask_email(match):
            email = match.group(0)
            parts = email.split('@')
            if len(parts) == 2:
                return 'XXX@' + parts[1]
            return 'XXX@XXX.XXX'
        text = cls.EMAIL_PATTERN.sub(mask_email, text)
        
        # Mask phone numbers
        text = cls.PHONE_PATTERN.sub('XXX-XXX-XXXX', text)
        
        return text
    
    @classmethod
    def validate_mime_type(cls, file_path: Path, expected_type: str) -> bool:
        """Validate that a file has the expected MIME type."""
        guessed_type, _ = mimetypes.guess_type(str(file_path))
        
        # Also check file content for PDF
        if expected_type == 'application/pdf':
            try:
                with open(file_path, 'rb') as f:
                    header = f.read(4)
                    return header == b'%PDF'
            except Exception:
                return False
        
        return guessed_type == expected_type
    
    @classmethod
    def is_safe_url(cls, url: str) -> bool:
        """Check if a URL is safe (no local file access, etc.)."""
        try:
            parsed = urlparse(url)
            
            # Block file:// URLs
            if parsed.scheme == 'file':
                return False
            
            # Block localhost/local IPs
            if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
                return False
            
            # Block local network IPs
            if parsed.hostname and (
                parsed.hostname.startswith('192.168.') or
                parsed.hostname.startswith('10.') or
                parsed.hostname.startswith('172.')
            ):
                return False
            
            return True
            
        except Exception:
            return False
    
    @classmethod
    def validate_extraction_data(cls, data: Dict[str, Any]) -> tuple[bool, str]:
        """
        Validate extraction data structure.
        Returns (is_valid, error_message)
        """
        required_fields = ['fields', 'tables', 'metadata']
        
        # Check required fields
        for field in required_fields:
            if field not in data:
                return False, f"Missing required field: {field}"
        
        # Validate fields
        if not isinstance(data['fields'], dict):
            return False, "Fields must be a dictionary"
        
        # Validate tables
        if not isinstance(data['tables'], list):
            return False, "Tables must be a list"
        
        # Validate metadata
        if not isinstance(data['metadata'], dict):
            return False, "Metadata must be a dictionary"
        
        # Check for injection attempts in field names
        for field_name in data['fields'].keys():
            if not re.match(r'^[\w\s_-]+$', field_name):
                return False, f"Invalid field name: {field_name}"
        
        return True, ""