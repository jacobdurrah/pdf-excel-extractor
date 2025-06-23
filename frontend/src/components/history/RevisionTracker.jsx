import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  GitBranch, 
  Clock, 
  User, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { 
  addRevision,
  getFieldHistory,
  logExtractionEvent,
  selectFieldHistory 
} from '../../store/slices/historySlice';
import { selectCurrentFile } from '../../store/slices/pdfSlice';

/**
 * RevisionTracker Component
 * 
 * Tracks and displays revision history for extracted fields.
 * Integrates with the Excel editor to log all changes.
 */
const RevisionTracker = ({ fieldName, currentValue, currentConfidence, onRevisionAdded }) => {
  const dispatch = useDispatch();
  const currentFile = useSelector(selectCurrentFile);
  const fieldHistory = useSelector(selectFieldHistory(currentFile?.hash, fieldName));
  
  // Load field history when component mounts or field changes
  useEffect(() => {
    if (currentFile?.hash && fieldName) {
      dispatch(getFieldHistory({ 
        fileHash: currentFile.hash, 
        fieldName 
      }));
    }
  }, [dispatch, currentFile?.hash, fieldName]);
  
  // Track value changes
  const trackValueChange = useCallback(async (newValue, newConfidence, reason = null) => {
    if (!currentFile?.hash || !fieldName) return;
    
    try {
      // Add revision
      const result = await dispatch(addRevision({
        file_hash: currentFile.hash,
        field_name: fieldName,
        old_value: currentValue,
        new_value: newValue,
        old_confidence: currentConfidence,
        new_confidence: newConfidence,
        changed_by: 'user', // In production, get from auth context
        reason: reason || 'Manual edit',
        parent_revision_id: fieldHistory?.revisions?.slice(-1)[0]?.revision_id
      })).unwrap();
      
      // Log the edit event
      await dispatch(logExtractionEvent({
        action: 'edit',
        user_id: 'user', // In production, get from auth context
        session_id: window.sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        value: newValue,
        confidence: newConfidence,
        details: {
          old_value: currentValue,
          revision_id: result.revision_id
        },
        success: true
      }));
      
      // Notify parent component
      if (onRevisionAdded) {
        onRevisionAdded(result.revision_id);
      }
      
      // Reload field history
      dispatch(getFieldHistory({ 
        fileHash: currentFile.hash, 
        fieldName 
      }));
    } catch (error) {
      console.error('Failed to track revision:', error);
      
      // Log error event
      dispatch(logExtractionEvent({
        action: 'error',
        user_id: 'user',
        session_id: window.sessionId,
        file_hash: currentFile.hash,
        file_name: currentFile.name,
        field_name: fieldName,
        error_message: error.message,
        error_type: 'revision_tracking_error',
        success: false
      }));
    }
  }, [dispatch, currentFile, fieldName, currentValue, currentConfidence, fieldHistory, onRevisionAdded]);
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Get confidence trend
  const getConfidenceTrend = () => {
    if (!fieldHistory?.revisions?.length) return null;
    
    const firstConfidence = fieldHistory.original_confidence;
    const lastConfidence = fieldHistory.current_confidence;
    const change = lastConfidence - firstConfidence;
    
    return {
      change,
      percentage: (change * 100).toFixed(1),
      isImprovement: change > 0
    };
  };
  
  // Render confidence badge
  const renderConfidenceBadge = (confidence) => {
    const getColor = () => {
      if (confidence >= 0.9) return 'bg-green-100 text-green-800';
      if (confidence >= 0.7) return 'bg-yellow-100 text-yellow-800';
      return 'bg-red-100 text-red-800';
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getColor()}`}>
        {(confidence * 100).toFixed(1)}%
      </span>
    );
  };
  
  if (!fieldHistory) {
    return null;
  }
  
  const confidenceTrend = getConfidenceTrend();
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold">Revision History</h3>
        </div>
        <div className="text-sm text-gray-500">
          {fieldHistory.revision_count} revision{fieldHistory.revision_count !== 1 ? 's' : ''}
        </div>
      </div>
      
      {/* Current State */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Current Value</span>
          {renderConfidenceBadge(fieldHistory.current_confidence)}
        </div>
        <div className="text-lg font-mono">{fieldHistory.current_value}</div>
        
        {confidenceTrend && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            {confidenceTrend.isImprovement ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-green-600">
                  +{confidenceTrend.percentage}% improvement
                </span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-red-600">
                  {confidenceTrend.percentage}% decrease
                </span>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* Original Value */}
      {fieldHistory.original_value !== fieldHistory.current_value && (
        <div className="mb-4 p-3 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Original Value</span>
            {renderConfidenceBadge(fieldHistory.original_confidence)}
          </div>
          <div className="text-lg font-mono text-gray-600">
            {fieldHistory.original_value}
          </div>
        </div>
      )}
      
      {/* Revision Timeline */}
      {fieldHistory.revisions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Change History</h4>
          <div className="space-y-3">
            {fieldHistory.revisions.map((revision, index) => (
              <div 
                key={revision.revision_id}
                className="relative pl-6 pb-3 border-l-2 border-gray-200 last:border-l-0"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-gray-400 rounded-full" />
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {revision.changed_by === 'user' ? (
                        <User className="w-4 h-4 text-blue-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                      )}
                      <span className="text-sm font-medium">
                        {revision.changed_by === 'user' ? 'Manual Edit' : 'System Update'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(revision.timestamp)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">From:</span>
                      <div className="font-mono mt-1">{revision.old_value}</div>
                      {renderConfidenceBadge(revision.old_confidence)}
                    </div>
                    <div>
                      <span className="text-gray-500">To:</span>
                      <div className="font-mono mt-1">{revision.new_value}</div>
                      {renderConfidenceBadge(revision.new_confidence)}
                    </div>
                  </div>
                  
                  {revision.reason && (
                    <div className="mt-2 text-sm text-gray-600 italic">
                      Reason: {revision.reason}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Last Modified */}
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
        Last modified: {formatTimestamp(fieldHistory.last_modified)}
      </div>
    </div>
  );
};

/**
 * Hook to integrate revision tracking with value changes
 */
export const useRevisionTracking = () => {
  const dispatch = useDispatch();
  const currentFile = useSelector(selectCurrentFile);
  
  const trackFieldChange = useCallback(async (
    fieldName,
    oldValue,
    newValue,
    oldConfidence,
    newConfidence,
    reason = null
  ) => {
    if (!currentFile?.hash || oldValue === newValue) return;
    
    try {
      const result = await dispatch(addRevision({
        file_hash: currentFile.hash,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        old_confidence: oldConfidence,
        new_confidence: newConfidence,
        changed_by: 'user',
        reason: reason
      })).unwrap();
      
      return result.revision_id;
    } catch (error) {
      console.error('Failed to track field change:', error);
      throw error;
    }
  }, [dispatch, currentFile]);
  
  return { trackFieldChange };
};

export default RevisionTracker;