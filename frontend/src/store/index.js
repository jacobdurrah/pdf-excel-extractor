import { configureStore } from '@reduxjs/toolkit';
import pdfReducer from './slices/pdfSlice';
import extractionReducer from './slices/extractionSlice';
import uiReducer from './slices/uiSlice';
import excelReducer from './slices/excelSlice';

export const store = configureStore({
  reducer: {
    pdf: pdfReducer,
    extraction: extractionReducer,
    ui: uiReducer,
    excel: excelReducer,
  },
});