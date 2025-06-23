import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  setSpreadsheetData, 
  updateCell, 
  selectCell, 
  setEditingCell,
  addRow,
  deleteRow,
  undo,
  redo,
  setValidationError 
} from '../../store/slices/excelSlice';
import { mockExcelData } from '../../mockData/extractionData';
import CustomSpreadsheet from './CustomSpreadsheet';
import CellEditor from './CellEditor';
import KeyboardHandler from './KeyboardHandler';
import FormulaBar from './FormulaBar';
import { detectCellType, formatCellValue, cellValidationRules } from './DataValidation';
import './ExcelPreview.css';

const ExcelPreview = () => {
  const dispatch = useDispatch();
  const { rows, selectedCell, editingCell, hasUnsavedChanges, validationErrors, headers } = useSelector(state => state.excel);
  const [showCellEditor, setShowCellEditor] = useState(false);
  const [cellEditorProps, setCellEditorProps] = useState(null);
  const spreadsheetRef = useRef(null);


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


  // Start editing a cell
  const startEditing = useCallback((row, col, initialChar = '') => {
    if (rows[row] && rows[row].cells[col] && rows[row].cells[col].editable !== false) {
      const cell = rows[row].cells[col];
      const cellElement = document.querySelector(
        `.Spreadsheet__table tr:nth-child(${row + 2}) td:nth-child(${col + 2})`
      );
      
      if (cellElement) {
        const rect = cellElement.getBoundingClientRect();
        setCellEditorProps({
          rowId: rows[row].id,
          cellIndex: col,
          initialValue: initialChar || cell.value,
          cellType: cell.type || detectCellType(cell.value),
          position: {
            top: rect.top,
            left: rect.left
          }
        });
        setShowCellEditor(true);
        dispatch(setEditingCell({ row, col }));
      }
    }
  }, [rows, dispatch]);



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
      
      <FormulaBar />
      
      <div className="spreadsheet-wrapper" ref={spreadsheetRef}>
        {rows.length > 0 && (
          <CustomSpreadsheet
            data={rows}
            headers={headers}
            onCellDoubleClick={startEditing}
            validationErrors={validationErrors}
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
    
    {/* Keyboard handler */}
    <KeyboardHandler onStartEdit={startEditing} />
    
    {/* Cell editor */}
    {showCellEditor && cellEditorProps && (
      <CellEditor
        {...cellEditorProps}
        onClose={() => {
          setShowCellEditor(false);
          setCellEditorProps(null);
          dispatch(setEditingCell(null));
        }}
      />
    )}
  </div>
  );
};

export default ExcelPreview;