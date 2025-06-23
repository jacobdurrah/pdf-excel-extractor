import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  headers: ['A', 'B', 'C', 'D', 'E'],
  rows: [],
  selectedCell: null,
  editingCell: null,
  copiedCells: null,
  history: {
    past: [],
    present: null,
    future: [],
  },
  hasUnsavedChanges: false,
  validationErrors: {},
};

const excelSlice = createSlice({
  name: 'excel',
  initialState,
  reducers: {
    setSpreadsheetData: (state, action) => {
      state.rows = action.payload.rows;
      state.headers = action.payload.headers || state.headers;
      state.history.present = action.payload.rows;
      state.hasUnsavedChanges = false;
    },
    updateCell: (state, action) => {
      const { rowId, cellIndex, value } = action.payload;
      const rowIndex = state.rows.findIndex(row => row.id === rowId);
      if (rowIndex !== -1 && state.rows[rowIndex].cells[cellIndex]) {
        // Save to history for undo/redo
        state.history.past.push(JSON.parse(JSON.stringify(state.rows)));
        state.history.future = [];
        
        // Update the cell
        state.rows[rowIndex].cells[cellIndex] = {
          ...state.rows[rowIndex].cells[cellIndex],
          value,
          source: 'manual',
          edited: true,
        };
        state.hasUnsavedChanges = true;
      }
    },
    selectCell: (state, action) => {
      state.selectedCell = action.payload;
    },
    setEditingCell: (state, action) => {
      state.editingCell = action.payload;
    },
    addRow: (state) => {
      const newRow = {
        id: `row-${Date.now()}`,
        cells: state.headers.map(() => ({
          value: '',
          type: 'text',
          source: 'manual',
          confidence: 1.0,
        })),
      };
      state.rows.push(newRow);
      state.hasUnsavedChanges = true;
    },
    deleteRow: (state, action) => {
      const rowIndex = state.rows.findIndex(row => row.id === action.payload);
      if (rowIndex !== -1) {
        state.history.past.push(JSON.parse(JSON.stringify(state.rows)));
        state.rows.splice(rowIndex, 1);
        state.hasUnsavedChanges = true;
      }
    },
    undo: (state) => {
      if (state.history.past.length > 0) {
        const previous = state.history.past.pop();
        state.history.future.push(JSON.parse(JSON.stringify(state.rows)));
        state.rows = previous;
      }
    },
    redo: (state) => {
      if (state.history.future.length > 0) {
        const next = state.history.future.pop();
        state.history.past.push(JSON.parse(JSON.stringify(state.rows)));
        state.rows = next;
      }
    },
    resetExcel: () => initialState,
    setCopiedCells: (state, action) => {
      state.copiedCells = action.payload;
    },
    pasteCells: (state, action) => {
      const { targetRow, targetCol } = action.payload;
      if (state.copiedCells && state.copiedCells.length > 0) {
        state.history.past.push(JSON.parse(JSON.stringify(state.rows)));
        state.history.future = [];
        
        state.copiedCells.forEach(copiedCell => {
          const rowOffset = targetRow - copiedCell.row;
          const colOffset = targetCol - copiedCell.col;
          const newRow = copiedCell.row + rowOffset;
          const newCol = copiedCell.col + colOffset;
          
          if (newRow >= 0 && newRow < state.rows.length && 
              newCol >= 0 && newCol < state.headers.length) {
            if (state.rows[newRow].cells[newCol].editable !== false) {
              state.rows[newRow].cells[newCol] = {
                ...state.rows[newRow].cells[newCol],
                value: copiedCell.value,
                source: 'manual',
                edited: true,
              };
            }
          }
        });
        
        state.hasUnsavedChanges = true;
      }
    },
    setValidationError: (state, action) => {
      const { rowId, cellIndex, error } = action.payload;
      const key = `${rowId}-${cellIndex}`;
      if (error) {
        state.validationErrors[key] = error;
      } else {
        delete state.validationErrors[key];
      }
    },
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
  },
});

export const { 
  setSpreadsheetData, 
  updateCell, 
  selectCell, 
  setEditingCell,
  addRow,
  deleteRow,
  undo,
  redo,
  resetExcel,
  setCopiedCells,
  pasteCells,
  setValidationError,
  clearValidationErrors,
} = excelSlice.actions;

export default excelSlice.reducer;