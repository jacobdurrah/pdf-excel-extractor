import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// Async thunks for API calls
export const searchHistory = createAsyncThunk(
  'history/search',
  async (filters) => {
    // Build query parameters
    const params = new URLSearchParams();
    
    if (filters.user_id) params.append('user_id', filters.user_id);
    if (filters.session_id) params.append('session_id', filters.session_id);
    if (filters.file_hash) params.append('file_hash', filters.file_hash);
    if (filters.actions?.length > 0) {
      filters.actions.forEach(action => params.append('actions', action));
    }
    if (filters.success_only !== undefined) params.append('success_only', filters.success_only);
    if (filters.start_date) params.append('start_date', filters.start_date.toISOString());
    if (filters.end_date) params.append('end_date', filters.end_date.toISOString());
    if (filters.search_text) params.append('search_text', filters.search_text);
    if (filters.min_confidence !== undefined) params.append('min_confidence', filters.min_confidence);
    if (filters.max_confidence !== undefined) params.append('max_confidence', filters.max_confidence);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const response = await window.electronAPI.fetch(`/api/history/search?${params.toString()}`);
    return response;
  }
);

export const getFieldHistory = createAsyncThunk(
  'history/getFieldHistory',
  async ({ fileHash, fieldName }) => {
    const response = await window.electronAPI.fetch(
      `/api/history/field/${fileHash}/${fieldName}`
    );
    return response;
  }
);

export const getFileSummary = createAsyncThunk(
  'history/getFileSummary',
  async (fileHash) => {
    const response = await window.electronAPI.fetch(
      `/api/history/file/${fileHash}/summary`
    );
    return response;
  }
);

export const getStatistics = createAsyncThunk(
  'history/getStatistics',
  async (hours = 24) => {
    const response = await window.electronAPI.fetch(
      `/api/history/statistics?hours=${hours}`
    );
    return response;
  }
);

export const addRevision = createAsyncThunk(
  'history/addRevision',
  async (revisionData) => {
    const response = await window.electronAPI.fetch('/api/history/revision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(revisionData),
    });
    return response;
  }
);

export const logExtractionEvent = createAsyncThunk(
  'history/logEvent',
  async (eventData) => {
    const response = await window.electronAPI.fetch('/api/history/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });
    return response;
  }
);

export const getConfidenceExplanation = createAsyncThunk(
  'history/getConfidenceExplanation',
  async (extractionId) => {
    const response = await window.electronAPI.fetch(
      `/api/history/confidence/${extractionId}/explanation`
    );
    return response;
  }
);

// Initial state
const initialState = {
  // History entries
  entries: [],
  filteredEntries: [],
  totalEntries: 0,
  
  // Current filters
  filters: {
    searchText: '',
    actionTypes: [],
    dateRange: 'all', // 'today', 'week', 'month', 'all'
    successOnly: false,
    fileHash: null,
    limit: 100,
    offset: 0,
  },
  
  // Field histories
  fieldHistories: {},
  
  // File summaries
  fileSummaries: {},
  
  // Statistics
  statistics: null,
  statisticsTimeRange: 24, // hours
  
  // UI state
  loading: false,
  error: null,
  selectedEntry: null,
  expandedRows: [],
  
  // Confidence explanations cache
  confidenceExplanations: {},
};

// Create the slice
const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    // Filter actions
    setSearchText: (state, action) => {
      state.filters.searchText = action.payload;
    },
    setActionTypes: (state, action) => {
      state.filters.actionTypes = action.payload;
    },
    setDateRange: (state, action) => {
      state.filters.dateRange = action.payload;
    },
    setSuccessOnly: (state, action) => {
      state.filters.successOnly = action.payload;
    },
    setFileHashFilter: (state, action) => {
      state.filters.fileHash = action.payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    
    // UI actions
    toggleRowExpansion: (state, action) => {
      const id = action.payload;
      const index = state.expandedRows.indexOf(id);
      if (index >= 0) {
        state.expandedRows.splice(index, 1);
      } else {
        state.expandedRows.push(id);
      }
    },
    setSelectedEntry: (state, action) => {
      state.selectedEntry = action.payload;
    },
    
    // Pagination
    setPage: (state, action) => {
      state.filters.offset = (action.payload - 1) * state.filters.limit;
    },
    setPageSize: (state, action) => {
      state.filters.limit = action.payload;
      state.filters.offset = 0;
    },
    
    // Clear caches
    clearFieldHistories: (state) => {
      state.fieldHistories = {};
    },
    clearFileSummaries: (state) => {
      state.fileSummaries = {};
    },
  },
  extraReducers: (builder) => {
    // Search history
    builder
      .addCase(searchHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.entries = action.payload;
        state.totalEntries = action.payload.length; // In real app, this would come from server
      })
      .addCase(searchHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
    
    // Field history
    builder
      .addCase(getFieldHistory.fulfilled, (state, action) => {
        const key = `${action.meta.arg.fileHash}:${action.meta.arg.fieldName}`;
        state.fieldHistories[key] = action.payload;
      });
    
    // File summary
    builder
      .addCase(getFileSummary.fulfilled, (state, action) => {
        state.fileSummaries[action.meta.arg] = action.payload;
      });
    
    // Statistics
    builder
      .addCase(getStatistics.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStatistics.fulfilled, (state, action) => {
        state.loading = false;
        state.statistics = action.payload;
        state.statisticsTimeRange = action.meta.arg || 24;
      })
      .addCase(getStatistics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
    
    // Add revision
    builder
      .addCase(addRevision.fulfilled, (state, action) => {
        // Refresh history after successful revision
        // In a real app, we might optimistically update the UI
      });
    
    // Confidence explanation
    builder
      .addCase(getConfidenceExplanation.fulfilled, (state, action) => {
        state.confidenceExplanations[action.meta.arg] = action.payload;
      });
  },
});

// Export actions
export const {
  setSearchText,
  setActionTypes,
  setDateRange,
  setSuccessOnly,
  setFileHashFilter,
  resetFilters,
  toggleRowExpansion,
  setSelectedEntry,
  setPage,
  setPageSize,
  clearFieldHistories,
  clearFileSummaries,
} = historySlice.actions;

// Selectors
export const selectHistoryEntries = (state) => state.history.entries;
export const selectHistoryFilters = (state) => state.history.filters;
export const selectHistoryStatistics = (state) => state.history.statistics;
export const selectHistoryLoading = (state) => state.history.loading;
export const selectHistoryError = (state) => state.history.error;
export const selectExpandedRows = (state) => state.history.expandedRows;
export const selectFieldHistory = (fileHash, fieldName) => (state) => 
  state.history.fieldHistories[`${fileHash}:${fieldName}`];
export const selectFileSummary = (fileHash) => (state) => 
  state.history.fileSummaries[fileHash];
export const selectConfidenceExplanation = (extractionId) => (state) =>
  state.history.confidenceExplanations[extractionId];

// Computed selectors
export const selectCurrentPage = (state) => {
  const { offset, limit } = state.history.filters;
  return Math.floor(offset / limit) + 1;
};

export const selectTotalPages = (state) => {
  const { limit } = state.history.filters;
  const total = state.history.totalEntries;
  return Math.ceil(total / limit);
};

export default historySlice.reducer;