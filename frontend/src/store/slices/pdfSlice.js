import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  fileName: null,
  fileSize: null,
  totalPages: 0,
  currentPage: 1,
  isLoading: false,
  error: null,
};

const pdfSlice = createSlice({
  name: 'pdf',
  initialState,
  reducers: {
    setPdfInfo: (state, action) => {
      const { fileName, fileSize, totalPages } = action.payload;
      state.fileName = fileName;
      state.fileSize = fileSize;
      state.totalPages = totalPages;
    },
    setCurrentPage: (state, action) => {
      state.currentPage = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    resetPdf: () => initialState,
  },
});

export const { setPdfInfo, setCurrentPage, setLoading, setError, resetPdf } = pdfSlice.actions;
export default pdfSlice.reducer;