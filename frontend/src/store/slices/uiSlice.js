import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  leftPanelWidth: 50, // percentage
  isExportDialogOpen: false,
  activeTab: 'excel', // excel, raw, preview
  theme: 'light',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLeftPanelWidth: (state, action) => {
      state.leftPanelWidth = action.payload;
    },
    toggleExportDialog: (state) => {
      state.isExportDialogOpen = !state.isExportDialogOpen;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
  },
});

export const { setLeftPanelWidth, toggleExportDialog, setActiveTab, setTheme } = uiSlice.actions;
export default uiSlice.reducer;