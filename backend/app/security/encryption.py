"""
Encryption utilities for data at rest and in transit.
Uses Fernet (symmetric encryption) for simplicity and security.
"""

import os
import base64
from pathlib import Path
from typing import Optional, Union
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class Encryptor:
    """Handles encryption and decryption of sensitive data."""
    
    def __init__(self, key: Optional[bytes] = None):
        """
        Initialize encryptor with a key.
        If no key provided, generates a new one.
        """
        if key:
            self.cipher = Fernet(key)
        else:
            self.cipher = Fernet(Fernet.generate_key())
    
    @classmethod
    def from_password(cls, password: str, salt: Optional[bytes] = None) -> 'Encryptor':
        """
        Create encryptor from a password using key derivation.
        """
        if salt is None:
            salt = os.urandom(16)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return cls(key)
    
    def get_key(self) -> bytes:
        """Get the encryption key (for storage)."""
        return self.cipher._signing_key + self.cipher._encryption_key
    
    def encrypt_bytes(self, data: bytes) -> bytes:
        """Encrypt bytes data."""
        return self.cipher.encrypt(data)
    
    def decrypt_bytes(self, encrypted_data: bytes) -> bytes:
        """Decrypt bytes data."""
        return self.cipher.decrypt(encrypted_data)
    
    def encrypt_string(self, text: str) -> str:
        """Encrypt a string and return base64 encoded result."""
        encrypted_bytes = self.encrypt_bytes(text.encode('utf-8'))
        return base64.urlsafe_b64encode(encrypted_bytes).decode('ascii')
    
    def decrypt_string(self, encrypted_text: str) -> str:
        """Decrypt a base64 encoded encrypted string."""
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_text.encode('ascii'))
        decrypted_bytes = self.decrypt_bytes(encrypted_bytes)
        return decrypted_bytes.decode('utf-8')
    
    def encrypt_file(self, input_path: Path, output_path: Optional[Path] = None) -> Path:
        """
        Encrypt a file. If no output path provided, overwrites the input file.
        Returns the path to the encrypted file.
        """
        output_path = output_path or input_path
        
        # Read file
        with open(input_path, 'rb') as f:
            data = f.read()
        
        # Encrypt
        encrypted_data = self.encrypt_bytes(data)
        
        # Write encrypted data
        with open(output_path, 'wb') as f:
            f.write(encrypted_data)
        
        return output_path
    
    def decrypt_file(self, input_path: Path, output_path: Optional[Path] = None) -> Path:
        """
        Decrypt a file. If no output path provided, overwrites the input file.
        Returns the path to the decrypted file.
        """
        output_path = output_path or input_path
        
        # Read encrypted file
        with open(input_path, 'rb') as f:
            encrypted_data = f.read()
        
        # Decrypt
        data = self.decrypt_bytes(encrypted_data)
        
        # Write decrypted data
        with open(output_path, 'wb') as f:
            f.write(data)
        
        return output_path
    
    def encrypt_json(self, data: dict) -> str:
        """Encrypt JSON data to string."""
        import json
        json_str = json.dumps(data)
        return self.encrypt_string(json_str)
    
    def decrypt_json(self, encrypted_data: str) -> dict:
        """Decrypt JSON data from string."""
        import json
        json_str = self.decrypt_string(encrypted_data)
        return json.loads(json_str)


class SessionEncryptor:
    """
    Manages encryption for a user session.
    Each session gets its own encryption key.
    """
    
    def __init__(self):
        self.sessions = {}
    
    def create_session(self, session_id: str) -> Encryptor:
        """Create a new encryption session."""
        encryptor = Encryptor()
        self.sessions[session_id] = encryptor
        return encryptor
    
    def get_session(self, session_id: str) -> Optional[Encryptor]:
        """Get encryptor for a session."""
        return self.sessions.get(session_id)
    
    def end_session(self, session_id: str):
        """End a session and remove its encryptor."""
        self.sessions.pop(session_id, None)
    
    def encrypt_for_session(self, session_id: str, data: Union[str, bytes]) -> Optional[Union[str, bytes]]:
        """Encrypt data for a specific session."""
        encryptor = self.get_session(session_id)
        if not encryptor:
            return None
        
        if isinstance(data, str):
            return encryptor.encrypt_string(data)
        else:
            return encryptor.encrypt_bytes(data)
    
    def decrypt_for_session(self, session_id: str, encrypted_data: Union[str, bytes]) -> Optional[Union[str, bytes]]:
        """Decrypt data for a specific session."""
        encryptor = self.get_session(session_id)
        if not encryptor:
            return None
        
        if isinstance(encrypted_data, str):
            return encryptor.decrypt_string(encrypted_data)
        else:
            return encryptor.decrypt_bytes(encrypted_data)