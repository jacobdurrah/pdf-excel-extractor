"""
Audit logging system for tracking all operations.
Provides complete audit trail for security and debugging.
"""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from uuid import uuid4
from contextlib import contextmanager
import threading
from enum import Enum

from ..models import AuditLog, SecurityConfig


class AuditAction(Enum):
    """Types of actions that can be audited."""
    UPLOAD = "upload"
    EXTRACT = "extract"
    EDIT = "edit"
    EXPORT = "export"
    DELETE = "delete"
    VIEW = "view"
    ERROR = "error"
    SECURITY = "security"


class AuditLogger:
    """Manages audit trail logging."""
    
    def __init__(self, db_path: Optional[Path] = None, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
        self.db_path = db_path or Path.home() / ".pdf_extractor" / "audit.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_database()
        self._start_cleanup_thread()
    
    def _init_database(self):
        """Initialize the audit database."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    timestamp REAL NOT NULL,
                    action TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    file_hash TEXT,
                    details TEXT,
                    confidence_before REAL,
                    confidence_after REAL,
                    duration_ms INTEGER,
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT
                )
            """)
            
            # Create indices for faster queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp 
                ON audit_logs(timestamp DESC)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_action 
                ON audit_logs(action)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_id 
                ON audit_logs(user_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_file_hash 
                ON audit_logs(file_hash)
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Get a database connection with proper error handling."""
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def log(
        self,
        action: AuditAction,
        user_id: str,
        file_hash: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        confidence_before: Optional[float] = None,
        confidence_after: Optional[float] = None,
        duration_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> str:
        """
        Log an audit event.
        Returns the audit log ID.
        """
        log_id = str(uuid4())
        timestamp = datetime.now().timestamp()
        
        with self._lock:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO audit_logs (
                        id, timestamp, action, user_id, file_hash,
                        details, confidence_before, confidence_after,
                        duration_ms, success, error_message
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    log_id, timestamp, action.value, user_id, file_hash,
                    json.dumps(details) if details else None,
                    confidence_before, confidence_after,
                    duration_ms, success, error_message
                ))
                conn.commit()
        
        return log_id
    
    def get_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        file_hash: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[AuditLog]:
        """Retrieve audit logs with filters."""
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params = []
        
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        
        if action:
            query += " AND action = ?"
            params.append(action.value)
        
        if file_hash:
            query += " AND file_hash = ?"
            params.append(file_hash)
        
        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time.timestamp())
        
        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time.timestamp())
        
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            logs = []
            
            for row in cursor:
                log = AuditLog(
                    id=row['id'],
                    timestamp=datetime.fromtimestamp(row['timestamp']),
                    action=row['action'],
                    user_id=row['user_id'],
                    file_hash=row['file_hash'],
                    details=json.loads(row['details']) if row['details'] else {},
                    confidence_before=row['confidence_before'],
                    confidence_after=row['confidence_after'],
                    duration_ms=row['duration_ms'],
                    success=bool(row['success']),
                    error_message=row['error_message']
                )
                logs.append(log)
        
        return logs
    
    def get_file_history(self, file_hash: str) -> List[AuditLog]:
        """Get complete history for a specific file."""
        return self.get_logs(file_hash=file_hash, limit=1000)
    
    def get_user_activity(self, user_id: str, hours: int = 24) -> List[AuditLog]:
        """Get recent activity for a user."""
        start_time = datetime.now() - timedelta(hours=hours)
        return self.get_logs(user_id=user_id, start_time=start_time)
    
    def cleanup_old_logs(self, days: Optional[int] = None):
        """Remove logs older than specified days."""
        days = days or self.config.audit_retention_days
        cutoff_time = (datetime.now() - timedelta(days=days)).timestamp()
        
        with self._lock:
            with self._get_connection() as conn:
                conn.execute(
                    "DELETE FROM audit_logs WHERE timestamp < ?",
                    (cutoff_time,)
                )
                conn.commit()
                
                # Vacuum to reclaim space
                conn.execute("VACUUM")
    
    def _start_cleanup_thread(self):
        """Start background thread for periodic cleanup."""
        def cleanup_worker():
            while True:
                try:
                    # Run cleanup daily
                    threading.Event().wait(86400)  # 24 hours
                    self.cleanup_old_logs()
                except Exception:
                    pass
        
        thread = threading.Thread(target=cleanup_worker, daemon=True)
        thread.start()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get audit log statistics."""
        with self._get_connection() as conn:
            # Total logs
            total = conn.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
            
            # Logs by action
            action_stats = {}
            for row in conn.execute("""
                SELECT action, COUNT(*) as count 
                FROM audit_logs 
                GROUP BY action
            """):
                action_stats[row['action']] = row['count']
            
            # Success rate
            success_count = conn.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE success = 1"
            ).fetchone()[0]
            
            # Recent activity (last 24 hours)
            recent_cutoff = (datetime.now() - timedelta(hours=24)).timestamp()
            recent_count = conn.execute(
                "SELECT COUNT(*) FROM audit_logs WHERE timestamp > ?",
                (recent_cutoff,)
            ).fetchone()[0]
            
            return {
                'total_logs': total,
                'actions': action_stats,
                'success_rate': (success_count / total * 100) if total > 0 else 100,
                'recent_activity_24h': recent_count
            }


class AuditContext:
    """Context manager for audited operations."""
    
    def __init__(
        self,
        logger: AuditLogger,
        action: AuditAction,
        user_id: str,
        file_hash: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.logger = logger
        self.action = action
        self.user_id = user_id
        self.file_hash = file_hash
        self.details = details or {}
        self.start_time = None
        self.log_id = None
    
    def __enter__(self):
        self.start_time = datetime.now()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = int((datetime.now() - self.start_time).total_seconds() * 1000)
        success = exc_type is None
        error_message = str(exc_val) if exc_val else None
        
        self.log_id = self.logger.log(
            action=self.action,
            user_id=self.user_id,
            file_hash=self.file_hash,
            details=self.details,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message
        )