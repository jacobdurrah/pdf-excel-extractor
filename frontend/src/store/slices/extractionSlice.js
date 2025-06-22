import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sessionId: null,
  status: 'idle', // idle, in_progress, completed, error
  totalFields: 0,
  completedFields: 0,
  fields: [],
  selectedFieldId: null,
};

const extractionSlice = createSlice({
  name: 'extraction',
  initialState,
  reducers: {
    setExtractionData: (state, action) => {
      return { ...state, ...action.payload };
    },
    updateField: (state, action) => {
      const { fieldId, updates } = action.payload;
      const fieldIndex = state.fields.findIndex(f => f.id === fieldId);
      if (fieldIndex !== -1) {
        state.fields[fieldIndex] = { ...state.fields[fieldIndex], ...updates };
      }
    },
    selectField: (state, action) => {
      state.selectedFieldId = action.payload;
    },
    setStatus: (state, action) => {
      state.status = action.payload;
    },
    resetExtraction: () => initialState,
  },
});

export const { setExtractionData, updateField, selectField, setStatus, resetExtraction } = extractionSlice.actions;
export default extractionSlice.reducer;