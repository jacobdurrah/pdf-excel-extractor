import React, { useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Spreadsheet from 'react-spreadsheet';
import { 
  setSpreadsheetData, 
  updateCell, 
  selectCell, 
  setEditingCell,
  addRow,
  deleteRow,
  undo,
  redo 
} from '../../store/slices/excelSlice';
import { mockExcelData } from '../../mockData/extractionData';
import './ExcelPreview.css';

const ExcelPreview = () => {
  const dispatch = useDispatch();
  const { rows, selectedCell, editingCell, hasUnsavedChanges } = useSelector(state => state.excel);
  const [spreadsheetData, setLocalSpreadsheetData] = useState([]);

  // Convert extraction data to spreadsheet format
  const convertToSpreadsheetFormat = useCallback((data) => {
    if (!data || !data.rows) return [];
    
    return data.rows.map(row => 
      row.cells.map(cell => ({
        value: cell.value || '',
        readOnly: cell.editable === false,
        className: getClassNameForCell(cell),
      }))
    );
  }, []);

  // Get cell styling based on data source and confidence
  const getClassNameForCell = (cell) => {
    const classes = [];
    
    if (cell.type === 'header') {
      classes.push('header-cell');
    }
    
    if (cell.source === 'extracted') {
      classes.push('extracted-cell');
      
      // Add confidence-based styling
      if (cell.confidence >= 0.9) {
        classes.push('high-confidence');
      } else if (cell.confidence >= 0.7) {
        classes.push('medium-confidence');
      } else {
        classes.push('low-confidence');
      }
    }
    
    if (cell.edited) {
      classes.push('edited-cell');
    }
    
    if (cell.type === 'currency') {
      classes.push('currency-cell');
    } else if (cell.type === 'date') {
      classes.push('date-cell');
    } else if (cell.type === 'number') {
      classes.push('number-cell');
    }
    
    return classes.join(' ');
  };

  // Initialize with mock data
  useEffect(() => {
    if (rows.length === 0) {
      // Convert mockExcelData to our data structure
      const mockRows = mockExcelData.map((row, rowIndex) => ({
        id: `row-${rowIndex}`,
        cells: row.map((cellValue, cellIndex) => ({
          value: cellValue,
          type: rowIndex === 0 ? 'header' : detectCellType(cellValue),
          source: rowIndex === 0 ? 'manual' : 'extracted',
          confidence: rowIndex === 0 ? 1.0 : 0.85 + Math.random() * 0.15,
          editable: rowIndex !== 0,
        })),
      }));

      dispatch(setSpreadsheetData({ 
        rows: mockRows,
        headers: ['A', 'B', 'C', 'D', 'E'] 
      }));
    }
  }, [dispatch, rows.length]);

  // Update local spreadsheet data when Redux state changes
  useEffect(() => {
    const convertedData = convertToSpreadsheetFormat({ rows });
    setLocalSpreadsheetData(convertedData);
  }, [rows, convertToSpreadsheetFormat]);

  // Detect cell type based on value
  const detectCellType = (value) => {
    if (typeof value !== 'string') return 'text';
    
    if (value.match(/^\$?[\d,]+\.?\d*$/)) {
      return value.startsWith('$') ? 'currency' : 'number';
    }
    if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      return 'date';
    }
    return 'text';
  };

  // Handle cell changes
  const handleCellChange = useCallback((data) => {
    // Find which cell changed
    data.forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        const currentRow = rows[rowIndex];
        if (currentRow && currentRow.cells[cellIndex]) {
          const oldValue = currentRow.cells[cellIndex].value;
          if (cell.value !== oldValue) {
            dispatch(updateCell({
              rowId: currentRow.id,
              cellIndex,
              value: cell.value,
            }));
          }
        }
      });
    });
  }, [dispatch, rows]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <div className="excel-preview-container">
      <div className="excel-toolbar">
        <div className="toolbar-left">
          <button 
            className="toolbar-btn"
            onClick={() => dispatch(undo())}
            title="Undo (Ctrl+Z)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
            </svg>
          </button>
          <button 
            className="toolbar-btn"
            onClick={() => dispatch(redo())}
            title="Redo (Ctrl+Y)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
              <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
            </svg>
          </button>
          <div className="toolbar-separator"></div>
          <button 
            className="toolbar-btn"
            onClick={() => dispatch(addRow())}
            title="Add Row"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4a.5.5 0 0 1 .5.5V7.5H11.5a.5.5 0 0 1 0 1H8.5v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Add Row
          </button>
        </div>
        <div className="toolbar-right">
          {hasUnsavedChanges && (
            <span className="unsaved-indicator">Unsaved changes</span>
          )}
        </div>
      </div>
      
      <div className="spreadsheet-wrapper">
        {spreadsheetData.length > 0 && (
          <Spreadsheet 
            data={spreadsheetData}
            onChange={handleCellChange}
            columnLabels={['A', 'B', 'C', 'D', 'E']}
          />
        )}
      </div>
      
      <div className="excel-status-bar">
        <div className="status-left">
          {selectedCell && (
            <span>Cell: {selectedCell.row + 1},{selectedCell.col + 1}</span>
          )}
        </div>
        <div className="status-right">
          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot extracted"></span>
              <span>Extracted</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot edited"></span>
              <span>Edited</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot high-conf"></span>
              <span>High Confidence</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot med-conf"></span>
              <span>Medium Confidence</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot low-conf"></span>
              <span>Low Confidence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelPreview;