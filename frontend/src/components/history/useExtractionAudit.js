import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  logExtractionEvent, 
  addRevision 
} from '../../store/slices/historySlice';
import { selectCurrentFile } from '../../store/slices/pdfSlice';

/**
 * Custom hook for integrating audit logging with extraction operations
 * 
 * This hook provides methods to log various extraction-related events
 * and track changes to extracted data.
 */
export const useExtractionAudit = () => {
  const dispatch = useDispatch();
  const currentFile = useSelector(selectCurrentFile);
  const sessionId = window.sessionStorage.getItem('sessionId') || 'default-session';
  const userId = 'user'; // In production, get from auth context
  
  /**
   * Log a file upload event
   */
  const logFileUpload = useCallback(async (fileInfo) => {
    try {
      await dispatch(logExtractionEvent({
        action: 'upload',
        user_id: userId,
        session_id: sessionId,
        file_hash: fileInfo.hash,
        file_name: fileInfo.name,
        file_size: fileInfo.size,
        details: {
          page_count: fileInfo.pageCount,
          upload_method: fileInfo.uploadMethod || 'drag-drop'
        },
        success: true
      })).unwrap();
    } catch (error) {
      console.error('Failed to log file upload:', error);
    }
  }, [dispatch, sessionId, userId]);
  
  /**
   * Log an extraction event
   */
  const logExtraction = useCallback(async ({
    fieldName,
    value,
    confidence,
    confidenceFactors,
    extractionMethod,
    duration,
    success = true,
    error = null
  }) => {
    if (!currentFile?.hash) return;
    
    try {
      await dispatch(logExtractionEvent({
        action: 'extract',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        value: value,
        confidence: confidence,
        confidence_factors: confidenceFactors,
        details: {
          extraction_method: extractionMethod,
          page_number: currentFile.currentPage
        },
        duration_ms: duration,
        success: success,
        error_message: error?.message,
        error_type: error?.type
      })).unwrap();
    } catch (err) {
      console.error('Failed to log extraction:', err);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log and track a field edit
   */
  const logFieldEdit = useCallback(async ({
    fieldName,
    oldValue,
    newValue,
    oldConfidence,
    newConfidence,
    reason
  }) => {
    if (!currentFile?.hash || oldValue === newValue) return;
    
    try {
      // First add the revision
      const revisionResult = await dispatch(addRevision({
        file_hash: currentFile.hash,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        old_confidence: oldConfidence,
        new_confidence: newConfidence,
        changed_by: userId,
        reason: reason
      })).unwrap();
      
      // Then log the edit event
      await dispatch(logExtractionEvent({
        action: 'edit',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        value: newValue,
        confidence: newConfidence,
        details: {
          old_value: oldValue,
          old_confidence: oldConfidence,
          revision_id: revisionResult.revision_id,
          edit_reason: reason
        },
        success: true
      })).unwrap();
      
      return revisionResult.revision_id;
    } catch (error) {
      console.error('Failed to log field edit:', error);
      throw error;
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log an export event
   */
  const logExport = useCallback(async ({
    format,
    fields,
    totalFields,
    includeMetadata
  }) => {
    if (!currentFile?.hash) return;
    
    try {
      await dispatch(logExtractionEvent({
        action: 'export',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        details: {
          export_format: format,
          fields_exported: fields,
          total_fields: totalFields,
          include_metadata: includeMetadata
        },
        success: true
      })).unwrap();
    } catch (error) {
      console.error('Failed to log export:', error);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log a view event
   */
  const logView = useCallback(async ({
    viewType,
    pageNumber,
    zoomLevel
  }) => {
    if (!currentFile?.hash) return;
    
    try {
      await dispatch(logExtractionEvent({
        action: 'view',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        details: {
          view_type: viewType,
          page_number: pageNumber,
          zoom_level: zoomLevel
        },
        success: true
      })).unwrap();
    } catch (error) {
      console.error('Failed to log view:', error);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log a validation event
   */
  const logValidation = useCallback(async ({
    fieldName,
    value,
    validationType,
    isValid,
    validationErrors,
    suggestions
  }) => {
    if (!currentFile?.hash) return;
    
    try {
      await dispatch(logExtractionEvent({
        action: 'validation',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        value: value,
        details: {
          validation_type: validationType,
          is_valid: isValid,
          validation_errors: validationErrors,
          suggestions: suggestions
        },
        success: isValid,
        error_message: validationErrors?.join(', ')
      })).unwrap();
    } catch (error) {
      console.error('Failed to log validation:', error);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log a confidence change event
   */
  const logConfidenceChange = useCallback(async ({
    fieldName,
    oldConfidence,
    newConfidence,
    changeReason,
    factors
  }) => {
    if (!currentFile?.hash) return;
    
    try {
      await dispatch(logExtractionEvent({
        action: 'confidence_change',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        confidence: newConfidence,
        confidence_factors: factors,
        details: {
          old_confidence: oldConfidence,
          confidence_change: newConfidence - oldConfidence,
          change_reason: changeReason
        },
        success: true
      })).unwrap();
    } catch (error) {
      console.error('Failed to log confidence change:', error);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Log a security event
   */
  const logSecurityEvent = useCallback(async ({
    eventType,
    severity,
    details,
    blocked = false
  }) => {
    try {
      await dispatch(logExtractionEvent({
        action: 'security',
        user_id: userId,
        session_id: sessionId,
        file_hash: currentFile?.hash,
        file_name: currentFile?.name,
        details: {
          event_type: eventType,
          severity: severity,
          blocked: blocked,
          ...details
        },
        success: !blocked,
        error_message: blocked ? `Security: ${eventType}` : null
      })).unwrap();
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, [dispatch, currentFile, sessionId, userId]);
  
  /**
   * Start tracking an operation with timing
   */
  const startOperation = useCallback(() => {
    const startTime = Date.now();
    
    return {
      complete: (logFunction, data) => {
        const duration = Date.now() - startTime;
        return logFunction({ ...data, duration });
      }
    };
  }, []);
  
  return {
    logFileUpload,
    logExtraction,
    logFieldEdit,
    logExport,
    logView,
    logValidation,
    logConfidenceChange,
    logSecurityEvent,
    startOperation
  };
};