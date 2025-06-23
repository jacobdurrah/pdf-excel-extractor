"""
Enhanced extraction history storage with revision tracking.
Extends the base audit logger with extraction-specific features.
"""

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from uuid import uuid4
from contextlib import contextmanager
import threading
from dataclasses import dataclass, asdict
import hashlib

from ..models import SecurityConfig
from ..models_audit_enhanced import (
    AuditLogEnhanced,
    ExtractionRevision,
    ExtractionFieldHistory,
    FileExtractionSummary,
    AuditSearchFilters,
    AuditStatistics,
    ExtractionHistoryEntry,
    ConfidenceExplanation,
    AuditActionType
)
from .audit_logger import AuditLogger, AuditAction


class ExtractionHistoryManager:
    """Manages extraction history with revision tracking and enhanced search."""
    
    def __init__(self, db_path: Optional[Path] = None, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
        self.db_path = db_path or Path.home() / ".pdf_extractor" / "extraction_history.db"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_database()
        
        # Initialize base audit logger
        self.audit_logger = AuditLogger(db_path=self.db_path.parent / "audit.db", config=config)
    
    def _init_database(self):
        """Initialize the extraction history database with enhanced schema."""
        with self._get_connection() as conn:
            # Main extraction history table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS extraction_history (
                    id TEXT PRIMARY KEY,
                    timestamp REAL NOT NULL,
                    action TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    session_id TEXT,
                    
                    -- File information
                    file_hash TEXT,
                    file_name TEXT,
                    file_size INTEGER,
                    
                    -- Operation details
                    details TEXT,  -- JSON
                    metadata TEXT,  -- JSON
                    
                    -- Performance
                    duration_ms INTEGER,
                    memory_used_mb REAL,
                    
                    -- Results
                    success BOOLEAN DEFAULT 1,
                    error_message TEXT,
                    error_type TEXT,
                    
                    -- Display helpers
                    display_message TEXT,
                    severity TEXT CHECK(severity IN ('info', 'warning', 'error', 'success')),
                    is_user_action BOOLEAN DEFAULT 1
                )
            """)
            
            # Extraction revisions table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS extraction_revisions (
                    revision_id TEXT PRIMARY KEY,
                    parent_revision_id TEXT,
                    timestamp REAL NOT NULL,
                    file_hash TEXT NOT NULL,
                    field_name TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT NOT NULL,
                    old_confidence REAL,
                    new_confidence REAL NOT NULL,
                    changed_by TEXT NOT NULL,  -- 'user' or 'system'
                    reason TEXT,
                    
                    FOREIGN KEY (parent_revision_id) REFERENCES extraction_revisions(revision_id)
                )
            """)
            
            # Field extraction tracking
            conn.execute("""
                CREATE TABLE IF NOT EXISTS field_extractions (
                    id TEXT PRIMARY KEY,
                    file_hash TEXT NOT NULL,
                    field_name TEXT NOT NULL,
                    current_value TEXT,
                    current_confidence REAL,
                    original_value TEXT,
                    original_confidence REAL,
                    revision_count INTEGER DEFAULT 0,
                    last_modified REAL NOT NULL,
                    
                    UNIQUE(file_hash, field_name)
                )
            """)
            
            # Confidence factors tracking
            conn.execute("""
                CREATE TABLE IF NOT EXISTS confidence_factors (
                    id TEXT PRIMARY KEY,
                    extraction_id TEXT NOT NULL,
                    factor_name TEXT NOT NULL,
                    score REAL NOT NULL,
                    weight REAL NOT NULL,
                    description TEXT
                )
            """)
            
            # Create indices for performance
            indices = [
                "CREATE INDEX IF NOT EXISTS idx_eh_timestamp ON extraction_history(timestamp DESC)",
                "CREATE INDEX IF NOT EXISTS idx_eh_action ON extraction_history(action)",
                "CREATE INDEX IF NOT EXISTS idx_eh_user ON extraction_history(user_id)",
                "CREATE INDEX IF NOT EXISTS idx_eh_session ON extraction_history(session_id)",
                "CREATE INDEX IF NOT EXISTS idx_eh_file ON extraction_history(file_hash)",
                "CREATE INDEX IF NOT EXISTS idx_er_file ON extraction_revisions(file_hash)",
                "CREATE INDEX IF NOT EXISTS idx_er_field ON extraction_revisions(field_name)",
                "CREATE INDEX IF NOT EXISTS idx_fe_file ON field_extractions(file_hash)",
                "CREATE INDEX IF NOT EXISTS idx_cf_extraction ON confidence_factors(extraction_id)"
            ]
            
            for index_sql in indices:
                conn.execute(index_sql)
            
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
    
    def log_extraction(
        self,
        action: AuditActionType,
        user_id: str,
        session_id: Optional[str] = None,
        file_info: Optional[Dict[str, Any]] = None,
        field_name: Optional[str] = None,
        value: Optional[str] = None,
        confidence: Optional[float] = None,
        confidence_factors: Optional[List[Dict[str, Any]]] = None,
        details: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        duration_ms: Optional[int] = None,
        memory_used_mb: Optional[float] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        error_type: Optional[str] = None
    ) -> str:
        """Log an extraction event with enhanced details."""
        log_id = str(uuid4())
        timestamp = datetime.now().timestamp()
        
        # Prepare file information
        file_hash = None
        file_name = None
        file_size = None
        if file_info:
            file_hash = file_info.get('hash')
            file_name = file_info.get('name')
            file_size = file_info.get('size')
        
        # Create display message
        display_message = self._create_display_message(
            action, file_name, field_name, value, confidence, success, error_message
        )
        
        # Determine severity
        severity = self._determine_severity(action, success, confidence)
        
        # Enhanced details
        enhanced_details = {
            **(details or {}),
            'field_name': field_name,
            'value': value,
            'confidence': confidence,
            'timestamp_iso': datetime.now().isoformat()
        }
        
        with self._lock:
            with self._get_connection() as conn:
                # Insert main history entry
                conn.execute("""
                    INSERT INTO extraction_history (
                        id, timestamp, action, user_id, session_id,
                        file_hash, file_name, file_size,
                        details, metadata,
                        duration_ms, memory_used_mb,
                        success, error_message, error_type,
                        display_message, severity, is_user_action
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    log_id, timestamp, action, user_id, session_id,
                    file_hash, file_name, file_size,
                    json.dumps(enhanced_details), json.dumps(metadata) if metadata else None,
                    duration_ms, memory_used_mb,
                    success, error_message, error_type,
                    display_message, severity, True
                ))
                
                # Log confidence factors if provided
                if confidence_factors:
                    for factor in confidence_factors:
                        conn.execute("""
                            INSERT INTO confidence_factors (
                                id, extraction_id, factor_name, score, weight, description
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            str(uuid4()), log_id,
                            factor['name'], factor['score'], factor['weight'],
                            factor.get('description')
                        ))
                
                # Update field extraction tracking
                if action == AuditActionType.EXTRACT and file_hash and field_name and value:
                    self._update_field_extraction(
                        conn, file_hash, field_name, value, confidence
                    )
                
                conn.commit()
        
        # Also log to base audit system for compatibility
        self.audit_logger.log(
            action=AuditAction(action),
            user_id=user_id,
            file_hash=file_hash,
            details=enhanced_details,
            confidence_before=None,
            confidence_after=confidence,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message
        )
        
        return log_id
    
    def add_revision(
        self,
        file_hash: str,
        field_name: str,
        old_value: str,
        new_value: str,
        old_confidence: float,
        new_confidence: float,
        changed_by: str,
        reason: Optional[str] = None,
        parent_revision_id: Optional[str] = None
    ) -> str:
        """Add a revision to track changes to extracted data."""
        revision_id = str(uuid4())
        timestamp = datetime.now().timestamp()
        
        with self._lock:
            with self._get_connection() as conn:
                # Insert revision
                conn.execute("""
                    INSERT INTO extraction_revisions (
                        revision_id, parent_revision_id, timestamp,
                        file_hash, field_name,
                        old_value, new_value,
                        old_confidence, new_confidence,
                        changed_by, reason
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    revision_id, parent_revision_id, timestamp,
                    file_hash, field_name,
                    old_value, new_value,
                    old_confidence, new_confidence,
                    changed_by, reason
                ))
                
                # Update field extraction tracking
                conn.execute("""
                    UPDATE field_extractions
                    SET current_value = ?, current_confidence = ?, 
                        revision_count = revision_count + 1, last_modified = ?
                    WHERE file_hash = ? AND field_name = ?
                """, (new_value, new_confidence, timestamp, file_hash, field_name))
                
                conn.commit()
        
        # Log the revision as an extraction event
        self.log_extraction(
            action=AuditActionType.REVISION,
            user_id=changed_by,
            file_info={'hash': file_hash},
            field_name=field_name,
            value=new_value,
            confidence=new_confidence,
            details={
                'revision_id': revision_id,
                'old_value': old_value,
                'old_confidence': old_confidence,
                'confidence_change': new_confidence - old_confidence,
                'reason': reason
            }
        )
        
        return revision_id
    
    def search_history(self, filters: AuditSearchFilters) -> List[ExtractionHistoryEntry]:
        """Search extraction history with advanced filters."""
        query = "SELECT * FROM extraction_history WHERE 1=1"
        params = []
        
        # Build query based on filters
        if filters.user_id:
            query += " AND user_id = ?"
            params.append(filters.user_id)
        
        if filters.session_id:
            query += " AND session_id = ?"
            params.append(filters.session_id)
        
        if filters.file_hash:
            query += " AND file_hash = ?"
            params.append(filters.file_hash)
        
        if filters.actions:
            placeholders = ','.join('?' * len(filters.actions))
            query += f" AND action IN ({placeholders})"
            params.extend(filters.actions)
        
        if filters.success_only is not None:
            query += " AND success = ?"
            params.append(1 if filters.success_only else 0)
        
        if filters.start_date:
            query += " AND timestamp >= ?"
            params.append(filters.start_date.timestamp())
        
        if filters.end_date:
            query += " AND timestamp <= ?"
            params.append(filters.end_date.timestamp())
        
        if filters.search_text:
            query += " AND (display_message LIKE ? OR details LIKE ? OR file_name LIKE ?)"
            search_pattern = f"%{filters.search_text}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        # Add ordering and pagination
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([filters.limit, filters.offset])
        
        entries = []
        with self._get_connection() as conn:
            cursor = conn.execute(query, params)
            
            for row in cursor:
                details = json.loads(row['details']) if row['details'] else {}
                
                # Determine display properties
                action_config = self._get_action_display_config(row['action'])
                
                entry = ExtractionHistoryEntry(
                    timestamp=datetime.fromtimestamp(row['timestamp']),
                    file_name=row['file_name'] or 'Unknown',
                    file_hash=row['file_hash'] or '',
                    action=row['action'],
                    field_name=details.get('field_name'),
                    old_value=details.get('old_value'),
                    new_value=details.get('value') or details.get('new_value'),
                    confidence=details.get('confidence'),
                    confidence_change=details.get('confidence_change'),
                    user_action=bool(row['is_user_action']),
                    success=bool(row['success']),
                    duration_ms=row['duration_ms'],
                    display_icon=action_config['icon'],
                    display_color=action_config['color']
                )
                entries.append(entry)
        
        return entries
    
    def get_field_history(self, file_hash: str, field_name: str) -> ExtractionFieldHistory:
        """Get complete history for a specific field."""
        with self._get_connection() as conn:
            # Get current field data
            field_row = conn.execute("""
                SELECT * FROM field_extractions
                WHERE file_hash = ? AND field_name = ?
            """, (file_hash, field_name)).fetchone()
            
            if not field_row:
                return None
            
            # Get all revisions
            revision_rows = conn.execute("""
                SELECT * FROM extraction_revisions
                WHERE file_hash = ? AND field_name = ?
                ORDER BY timestamp ASC
            """, (file_hash, field_name)).fetchall()
            
            revisions = []
            for row in revision_rows:
                revision = ExtractionRevision(
                    revision_id=row['revision_id'],
                    parent_revision_id=row['parent_revision_id'],
                    timestamp=datetime.fromtimestamp(row['timestamp']),
                    field_name=row['field_name'],
                    old_value=row['old_value'],
                    new_value=row['new_value'],
                    old_confidence=row['old_confidence'],
                    new_confidence=row['new_confidence'],
                    changed_by=row['changed_by'],
                    reason=row['reason']
                )
                revisions.append(revision)
            
            return ExtractionFieldHistory(
                field_name=field_row['field_name'],
                current_value=field_row['current_value'],
                current_confidence=field_row['current_confidence'],
                original_value=field_row['original_value'],
                original_confidence=field_row['original_confidence'],
                revision_count=field_row['revision_count'],
                revisions=revisions,
                last_modified=datetime.fromtimestamp(field_row['last_modified'])
            )
    
    def get_file_summary(self, file_hash: str) -> FileExtractionSummary:
        """Get extraction summary for a file."""
        with self._get_connection() as conn:
            # Get file info from first entry
            file_info = conn.execute("""
                SELECT file_name, file_size, MIN(timestamp) as upload_date
                FROM extraction_history
                WHERE file_hash = ?
                GROUP BY file_hash
            """, (file_hash,)).fetchone()
            
            if not file_info:
                return None
            
            # Get extraction statistics
            stats = conn.execute("""
                SELECT 
                    COUNT(*) as total_extractions,
                    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
                    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
                    MAX(timestamp) as last_modified
                FROM extraction_history
                WHERE file_hash = ? AND action = 'extract'
            """, (file_hash,)).fetchone()
            
            # Get fields and average confidence
            fields_data = conn.execute("""
                SELECT field_name, current_confidence, revision_count
                FROM field_extractions
                WHERE file_hash = ?
            """, (file_hash,)).fetchall()
            
            fields = []
            total_confidence = 0
            total_revisions = 0
            
            for field in fields_data:
                fields.append(field['field_name'])
                if field['current_confidence']:
                    total_confidence += field['current_confidence']
                total_revisions += field['revision_count']
            
            avg_confidence = total_confidence / len(fields) if fields else 0
            
            # Get export count
            export_count = conn.execute("""
                SELECT COUNT(*) FROM extraction_history
                WHERE file_hash = ? AND action = 'export'
            """, (file_hash,)).fetchone()[0]
            
            return FileExtractionSummary(
                file_hash=file_hash,
                file_name=file_info['file_name'],
                upload_date=datetime.fromtimestamp(file_info['upload_date']),
                last_modified=datetime.fromtimestamp(stats['last_modified']),
                total_extractions=stats['total_extractions'],
                successful_extractions=stats['successful'],
                failed_extractions=stats['failed'],
                average_confidence=avg_confidence,
                fields_extracted=fields,
                revision_count=total_revisions,
                export_count=export_count
            )
    
    def get_statistics(self, hours: int = 24) -> AuditStatistics:
        """Get comprehensive statistics."""
        cutoff_time = (datetime.now() - timedelta(hours=hours)).timestamp()
        
        with self._get_connection() as conn:
            # Overall statistics
            total_ops = conn.execute("SELECT COUNT(*) FROM extraction_history").fetchone()[0]
            success_ops = conn.execute(
                "SELECT COUNT(*) FROM extraction_history WHERE success = 1"
            ).fetchone()[0]
            failed_ops = total_ops - success_ops
            
            # Operations by type
            ops_by_type = {}
            for row in conn.execute("""
                SELECT action, COUNT(*) as count
                FROM extraction_history
                GROUP BY action
            """):
                ops_by_type[row['action']] = row['count']
            
            # Time-based statistics
            ops_last_hour = conn.execute("""
                SELECT COUNT(*) FROM extraction_history
                WHERE timestamp > ?
            """, ((datetime.now() - timedelta(hours=1)).timestamp(),)).fetchone()[0]
            
            ops_last_24h = conn.execute("""
                SELECT COUNT(*) FROM extraction_history
                WHERE timestamp > ?
            """, ((datetime.now() - timedelta(hours=24)).timestamp(),)).fetchone()[0]
            
            ops_last_7d = conn.execute("""
                SELECT COUNT(*) FROM extraction_history
                WHERE timestamp > ?
            """, ((datetime.now() - timedelta(days=7)).timestamp(),)).fetchone()[0]
            
            # File and extraction statistics
            unique_files = conn.execute(
                "SELECT COUNT(DISTINCT file_hash) FROM extraction_history WHERE file_hash IS NOT NULL"
            ).fetchone()[0]
            
            total_extractions = conn.execute(
                "SELECT COUNT(*) FROM extraction_history WHERE action = 'extract'"
            ).fetchone()[0]
            
            # Average confidence
            avg_conf_result = conn.execute("""
                SELECT AVG(current_confidence) FROM field_extractions
                WHERE current_confidence IS NOT NULL
            """).fetchone()[0]
            avg_confidence = avg_conf_result or 0
            
            # User statistics
            active_users = conn.execute(
                "SELECT COUNT(DISTINCT user_id) FROM extraction_history"
            ).fetchone()[0]
            
            ops_per_user = {}
            for row in conn.execute("""
                SELECT user_id, COUNT(*) as count
                FROM extraction_history
                GROUP BY user_id
                LIMIT 10
            """):
                ops_per_user[row['user_id']] = row['count']
            
            # Performance statistics
            perf_stats = conn.execute("""
                SELECT 
                    AVG(duration_ms) as avg_duration,
                    AVG(memory_used_mb) as avg_memory
                FROM extraction_history
                WHERE duration_ms IS NOT NULL
            """).fetchone()
            
            return AuditStatistics(
                total_operations=total_ops,
                successful_operations=success_ops,
                failed_operations=failed_ops,
                success_rate=success_ops / total_ops if total_ops > 0 else 1.0,
                operations_by_type=ops_by_type,
                operations_last_hour=ops_last_hour,
                operations_last_24h=ops_last_24h,
                operations_last_7d=ops_last_7d,
                unique_files_processed=unique_files,
                total_extractions=total_extractions,
                average_confidence=avg_confidence,
                active_users=active_users,
                operations_per_user=ops_per_user,
                average_duration_ms=perf_stats['avg_duration'] or 0,
                average_memory_mb=perf_stats['avg_memory'] or 0
            )
    
    def _update_field_extraction(
        self,
        conn: sqlite3.Connection,
        file_hash: str,
        field_name: str,
        value: str,
        confidence: float
    ):
        """Update or create field extraction record."""
        timestamp = datetime.now().timestamp()
        
        # Check if field exists
        existing = conn.execute("""
            SELECT * FROM field_extractions
            WHERE file_hash = ? AND field_name = ?
        """, (file_hash, field_name)).fetchone()
        
        if existing:
            # Update existing
            conn.execute("""
                UPDATE field_extractions
                SET current_value = ?, current_confidence = ?, last_modified = ?
                WHERE file_hash = ? AND field_name = ?
            """, (value, confidence, timestamp, file_hash, field_name))
        else:
            # Create new
            conn.execute("""
                INSERT INTO field_extractions (
                    id, file_hash, field_name,
                    current_value, current_confidence,
                    original_value, original_confidence,
                    revision_count, last_modified
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                str(uuid4()), file_hash, field_name,
                value, confidence,
                value, confidence,
                0, timestamp
            ))
    
    def _create_display_message(
        self,
        action: str,
        file_name: Optional[str],
        field_name: Optional[str],
        value: Optional[str],
        confidence: Optional[float],
        success: bool,
        error_message: Optional[str]
    ) -> str:
        """Create a user-friendly display message."""
        if not success and error_message:
            return f"Failed: {error_message}"
        
        messages = {
            AuditActionType.UPLOAD: f"Uploaded {file_name or 'file'}",
            AuditActionType.EXTRACT: f"Extracted {field_name or 'field'}" + 
                (f" with {confidence*100:.1f}% confidence" if confidence else ""),
            AuditActionType.EDIT: f"Edited {field_name or 'field'}",
            AuditActionType.EXPORT: f"Exported data from {file_name or 'file'}",
            AuditActionType.DELETE: f"Deleted {file_name or 'file'}",
            AuditActionType.VIEW: f"Viewed {file_name or 'file'}",
            AuditActionType.REVISION: f"Updated {field_name or 'field'} confidence",
            AuditActionType.CONFIDENCE_CHANGE: f"Confidence changed for {field_name or 'field'}",
            AuditActionType.VALIDATION: f"Validated {field_name or 'data'}"
        }
        
        return messages.get(action, f"{action} operation on {file_name or 'file'}")
    
    def _determine_severity(
        self,
        action: str,
        success: bool,
        confidence: Optional[float]
    ) -> str:
        """Determine severity level for display."""
        if not success:
            return "error"
        
        if action in [AuditActionType.ERROR, AuditActionType.VALIDATION]:
            return "warning"
        
        if action in [AuditActionType.EXTRACT, AuditActionType.EXPORT]:
            if confidence and confidence < 0.7:
                return "warning"
            return "success"
        
        return "info"
    
    def _get_action_display_config(self, action: str) -> Dict[str, str]:
        """Get display configuration for an action."""
        configs = {
            AuditActionType.UPLOAD: {"icon": "Upload", "color": "blue"},
            AuditActionType.EXTRACT: {"icon": "FileText", "color": "green"},
            AuditActionType.EDIT: {"icon": "Edit3", "color": "yellow"},
            AuditActionType.EXPORT: {"icon": "Download", "color": "purple"},
            AuditActionType.DELETE: {"icon": "Trash2", "color": "red"},
            AuditActionType.VIEW: {"icon": "Eye", "color": "gray"},
            AuditActionType.ERROR: {"icon": "AlertCircle", "color": "red"},
            AuditActionType.SECURITY: {"icon": "Shield", "color": "indigo"},
            AuditActionType.REVISION: {"icon": "RefreshCw", "color": "orange"},
            AuditActionType.CONFIDENCE_CHANGE: {"icon": "TrendingUp", "color": "blue"},
            AuditActionType.VALIDATION: {"icon": "CheckCircle", "color": "green"}
        }
        
        return configs.get(action, {"icon": "Activity", "color": "gray"})


# Singleton instance
_history_manager = None


def get_history_manager() -> ExtractionHistoryManager:
    """Get the singleton history manager instance."""
    global _history_manager
    if _history_manager is None:
        _history_manager = ExtractionHistoryManager()
    return _history_manager