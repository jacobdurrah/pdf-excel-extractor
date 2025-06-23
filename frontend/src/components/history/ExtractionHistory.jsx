import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Clock,
  FileText,
  Edit3,
  Download,
  Upload,
  Eye,
  AlertCircle,
  Shield,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info
} from 'lucide-react';

/**
 * ExtractionHistory Component
 * 
 * Displays a comprehensive audit trail of all extraction operations,
 * building user trust by showing transparency in all operations.
 */
const ExtractionHistory = () => {
  const dispatch = useDispatch();
  
  // State for history data
  const [historyEntries, setHistoryEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    searchText: '',
    actionTypes: [],
    dateRange: 'all', // 'today', 'week', 'month', 'all'
    successOnly: false,
    fileHash: null
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Expanded rows for details
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Statistics
  const [statistics, setStatistics] = useState(null);

  // Action type configuration
  const actionTypeConfig = {
    upload: { icon: Upload, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    extract: { icon: FileText, color: 'text-green-600', bgColor: 'bg-green-100' },
    edit: { icon: Edit3, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    export: { icon: Download, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    view: { icon: Eye, color: 'text-gray-600', bgColor: 'bg-gray-100' },
    error: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
    security: { icon: Shield, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
    revision: { icon: RefreshCw, color: 'text-orange-600', bgColor: 'bg-orange-100' }
  };

  // Load history data
  useEffect(() => {
    loadHistoryData();
  }, [filters]);

  const loadHistoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // In production, this would call the IPC API
      // For now, using mock data
      const mockData = generateMockHistoryData();
      setHistoryEntries(mockData);
      setFilteredEntries(applyFilters(mockData, filters));
      setStatistics(calculateStatistics(mockData));
    } catch (err) {
      setError('Failed to load history data');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Apply filters to entries
  const applyFilters = (entries, filters) => {
    let filtered = [...entries];
    
    // Search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.fileName?.toLowerCase().includes(searchLower) ||
        entry.fieldName?.toLowerCase().includes(searchLower) ||
        entry.displayMessage?.toLowerCase().includes(searchLower)
      );
    }
    
    // Action types
    if (filters.actionTypes.length > 0) {
      filtered = filtered.filter(entry => 
        filters.actionTypes.includes(entry.action)
      );
    }
    
    // Date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate;
      
      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }
      
      if (startDate) {
        filtered = filtered.filter(entry => 
          new Date(entry.timestamp) >= startDate
        );
      }
    }
    
    // Success only
    if (filters.successOnly) {
      filtered = filtered.filter(entry => entry.success);
    }
    
    // File filter
    if (filters.fileHash) {
      filtered = filtered.filter(entry => entry.fileHash === filters.fileHash);
    }
    
    return filtered;
  };

  // Calculate statistics
  const calculateStatistics = (entries) => {
    const stats = {
      totalOperations: entries.length,
      successfulOperations: entries.filter(e => e.success).length,
      failedOperations: entries.filter(e => !e.success).length,
      operationsByType: {},
      averageConfidence: 0,
      confidenceImprovement: 0
    };
    
    // Count by type
    entries.forEach(entry => {
      stats.operationsByType[entry.action] = 
        (stats.operationsByType[entry.action] || 0) + 1;
    });
    
    // Calculate average confidence
    const confidenceEntries = entries.filter(e => e.confidence !== null);
    if (confidenceEntries.length > 0) {
      stats.averageConfidence = 
        confidenceEntries.reduce((sum, e) => sum + e.confidence, 0) / 
        confidenceEntries.length;
    }
    
    // Calculate confidence improvement
    const revisions = entries.filter(e => e.action === 'revision' && e.confidenceChange);
    if (revisions.length > 0) {
      stats.confidenceImprovement = 
        revisions.reduce((sum, e) => sum + e.confidenceChange, 0) / 
        revisions.length;
    }
    
    stats.successRate = stats.totalOperations > 0 
      ? (stats.successfulOperations / stats.totalOperations * 100).toFixed(1)
      : 100;
    
    return stats;
  };

  // Toggle row expansion
  const toggleRowExpansion = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Format confidence value
  const formatConfidence = (confidence) => {
    if (confidence === null || confidence === undefined) return '-';
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Render action icon
  const renderActionIcon = (action) => {
    const config = actionTypeConfig[action] || actionTypeConfig.view;
    const Icon = config.icon;
    return (
      <div className={`p-2 rounded-lg ${config.bgColor}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
    );
  };

  // Render statistics card
  const renderStatisticsCard = () => {
    if (!statistics) return null;
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Activity Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {statistics.totalOperations}
            </div>
            <div className="text-sm text-gray-500">Total Operations</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {statistics.successRate}%
            </div>
            <div className="text-sm text-gray-500">Success Rate</div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold ${getConfidenceColor(statistics.averageConfidence)}`}>
              {formatConfidence(statistics.averageConfidence)}
            </div>
            <div className="text-sm text-gray-500">Avg Confidence</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 flex items-center justify-center">
              {statistics.confidenceImprovement > 0 ? (
                <>
                  <TrendingUp className="w-6 h-6 mr-1" />
                  +{(statistics.confidenceImprovement * 100).toFixed(1)}%
                </>
              ) : (
                <>
                  <TrendingDown className="w-6 h-6 mr-1" />
                  {(statistics.confidenceImprovement * 100).toFixed(1)}%
                </>
              )}
            </div>
            <div className="text-sm text-gray-500">Confidence Trend</div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {Object.entries(statistics.operationsByType).map(([type, count]) => {
              const config = actionTypeConfig[type] || actionTypeConfig.view;
              return (
                <div
                  key={type}
                  className={`px-3 py-1 rounded-full text-sm ${config.bgColor} ${config.color}`}
                >
                  {type}: {count}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render filters
  const renderFilters = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search files, fields, or messages..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filters.searchText}
                onChange={(e) => setFilters({ ...filters, searchText: e.target.value })}
              />
            </div>
          </div>
          
          {/* Date Range */}
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            value={filters.dateRange}
            onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last Month</option>
          </select>
          
          {/* Action Type Filter */}
          <div className="relative">
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-2 hover:bg-gray-50"
              onClick={() => {/* Toggle dropdown */}}
            >
              <Filter className="w-4 h-4" />
              Actions ({filters.actionTypes.length})
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          
          {/* Success Only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={filters.successOnly}
              onChange={(e) => setFilters({ ...filters, successOnly: e.target.checked })}
            />
            <span className="text-sm text-gray-700">Success Only</span>
          </label>
          
          {/* Refresh */}
          <button
            onClick={loadHistoryData}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // Render history entry row
  const renderHistoryRow = (entry) => {
    const isExpanded = expandedRows.has(entry.id);
    
    return (
      <React.Fragment key={entry.id}>
        <tr 
          className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
          onClick={() => toggleRowExpansion(entry.id)}
        >
          <td className="px-4 py-3">
            <button className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </td>
          <td className="px-4 py-3">
            {renderActionIcon(entry.action)}
          </td>
          <td className="px-4 py-3">
            <div className="text-sm font-medium text-gray-900">{entry.fileName || '-'}</div>
            {entry.fieldName && (
              <div className="text-xs text-gray-500">Field: {entry.fieldName}</div>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="text-sm text-gray-700">{entry.displayMessage}</div>
          </td>
          <td className="px-4 py-3">
            {entry.confidence !== null && (
              <div className={`text-sm font-medium ${getConfidenceColor(entry.confidence)}`}>
                {formatConfidence(entry.confidence)}
                {entry.confidenceChange && (
                  <span className={`text-xs ml-1 ${entry.confidenceChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({entry.confidenceChange > 0 ? '+' : ''}{(entry.confidenceChange * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="text-xs text-gray-500">{formatTimestamp(entry.timestamp)}</div>
          </td>
          <td className="px-4 py-3">
            {entry.success ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Success
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Failed
              </span>
            )}
          </td>
        </tr>
        
        {/* Expanded details */}
        {isExpanded && (
          <tr>
            <td colSpan="7" className="px-4 py-4 bg-gray-50">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Session ID:</span>
                    <span className="ml-2 text-gray-600">{entry.sessionId || '-'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Duration:</span>
                    <span className="ml-2 text-gray-600">
                      {entry.durationMs ? `${entry.durationMs}ms` : '-'}
                    </span>
                  </div>
                  {entry.oldValue && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Previous Value:</span>
                      <span className="ml-2 text-gray-600">{entry.oldValue}</span>
                    </div>
                  )}
                  {entry.newValue && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">New Value:</span>
                      <span className="ml-2 text-gray-600">{entry.newValue}</span>
                    </div>
                  )}
                </div>
                
                {entry.confidenceBreakdown && (
                  <div className="border-t pt-3">
                    <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Confidence Breakdown
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(entry.confidenceBreakdown).map(([factor, score]) => (
                        <div key={factor} className="flex justify-between text-sm">
                          <span className="text-gray-600">{factor}:</span>
                          <span className={`font-medium ${getConfidenceColor(score)}`}>
                            {formatConfidence(score)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {entry.errorMessage && (
                  <div className="border-t pt-3">
                    <div className="flex items-start gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 mt-0.5" />
                      <span>{entry.errorMessage}</span>
                    </div>
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  // Pagination
  const paginate = (entries) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return entries.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);

  // Render main content
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Extraction History</h2>
        <p className="text-gray-600">
          Complete audit trail of all operations. Every action is logged for transparency and trust.
        </p>
      </div>
      
      {renderStatisticsCard()}
      {renderFilters()}
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File/Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginate(filteredEntries).map(entry => renderHistoryRow(entry))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredEntries.length)} of{' '}
              {filteredEntries.length} entries
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Mock data generator for testing
const generateMockHistoryData = () => {
  const actions = ['upload', 'extract', 'edit', 'export', 'view', 'revision'];
  const files = ['invoice_2024.pdf', 'receipt_march.pdf', 'contract_final.pdf'];
  const fields = ['invoice_number', 'date', 'amount', 'vendor_name', 'tax_id'];
  
  const entries = [];
  const now = new Date();
  
  for (let i = 0; i < 50; i++) {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    const entry = {
      id: `entry-${i}`,
      timestamp: timestamp.toISOString(),
      action,
      sessionId: `session-${Math.floor(i / 10)}`,
      fileName: files[Math.floor(Math.random() * files.length)],
      fileHash: `hash-${Math.floor(Math.random() * 10)}`,
      success: Math.random() > 0.1,
      durationMs: Math.floor(Math.random() * 1000) + 100,
      userAction: Math.random() > 0.3
    };
    
    // Add action-specific data
    switch (action) {
      case 'extract':
        entry.fieldName = fields[Math.floor(Math.random() * fields.length)];
        entry.confidence = Math.random() * 0.4 + 0.6;
        entry.displayMessage = `Extracted ${entry.fieldName} with ${formatConfidence(entry.confidence)} confidence`;
        entry.confidenceBreakdown = {
          'Pattern Match': Math.random() * 0.3 + 0.7,
          'OCR Quality': Math.random() * 0.3 + 0.6,
          'Context': Math.random() * 0.2 + 0.8,
          'Location': Math.random() * 0.3 + 0.7
        };
        break;
        
      case 'edit':
        entry.fieldName = fields[Math.floor(Math.random() * fields.length)];
        entry.oldValue = `old-${Math.random().toString(36).substring(7)}`;
        entry.newValue = `new-${Math.random().toString(36).substring(7)}`;
        entry.displayMessage = `Edited ${entry.fieldName}`;
        break;
        
      case 'revision':
        entry.fieldName = fields[Math.floor(Math.random() * fields.length)];
        entry.confidence = Math.random() * 0.3 + 0.7;
        entry.confidenceChange = (Math.random() - 0.3) * 0.2;
        entry.displayMessage = `Confidence updated for ${entry.fieldName}`;
        break;
        
      case 'upload':
        entry.displayMessage = `Uploaded ${entry.fileName}`;
        break;
        
      case 'export':
        entry.displayMessage = `Exported data to Excel`;
        break;
        
      case 'view':
        entry.displayMessage = `Viewed ${entry.fileName}`;
        break;
    }
    
    if (!entry.success) {
      entry.errorMessage = 'Operation failed due to validation error';
    }
    
    entries.push(entry);
  }
  
  return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

// Helper function
const formatConfidence = (confidence) => {
  if (confidence === null || confidence === undefined) return '-';
  return `${(confidence * 100).toFixed(1)}%`;
};

export default ExtractionHistory;