import React, { useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCell, updateCell } from '../../store/slices/excelSlice';
import { formatCellValue } from './DataValidation';

const CustomSpreadsheet = ({ 
  data, 
  headers, 
  onCellDoubleClick,
  validationErrors 
}) => {
  const dispatch = useDispatch();
  const { selectedCell, copiedCells } = useSelector(state => state.excel);
  const tableRef = useRef(null);

  const handleCellClick = useCallback((rowIndex, colIndex) => {
    dispatch(selectCell({ row: rowIndex, col: colIndex }));
  }, [dispatch]);

  const getCellClass = useCallback((cell, rowIndex, colIndex) => {
    const classes = [cell.className || ''];
    
    // Add selected class
    if (selectedCell && selectedCell.row === rowIndex && selectedCell.col === colIndex) {
      classes.push('selected');
    }
    
    // Add copied class
    if (copiedCells && copiedCells.some(c => c.row === rowIndex && c.col === colIndex)) {
      classes.push('copied');
    }
    
    // Add validation error class
    const errorKey = `${data[rowIndex]?.id}-${colIndex}`;
    if (validationErrors && validationErrors[errorKey]) {
      classes.push('validation-error');
    }
    
    return classes.filter(Boolean).join(' ');
  }, [selectedCell, copiedCells, validationErrors, data]);

  const renderCell = useCallback((cell, rowIndex, colIndex) => {
    const cellData = data[rowIndex]?.cells?.[colIndex];
    const formattedValue = cellData ? formatCellValue(cellData.value, cellData.type) : cell.value;
    
    return (
      <td
        key={`cell-${rowIndex}-${colIndex}`}
        className={`Spreadsheet__cell ${getCellClass(cell, rowIndex, colIndex)}`}
        onClick={() => handleCellClick(rowIndex, colIndex)}
        onDoubleClick={() => onCellDoubleClick(rowIndex, colIndex)}
        data-row={rowIndex}
        data-col={colIndex}
        title={cellData?.confidence ? `Confidence: ${(cellData.confidence * 100).toFixed(0)}%` : ''}
      >
        <div className="cell-content">
          {formattedValue}
        </div>
      </td>
    );
  }, [data, getCellClass, handleCellClick, onCellDoubleClick]);

  return (
    <table className="Spreadsheet__table" ref={tableRef}>
      <thead>
        <tr>
          <th className="Spreadsheet__header"></th>
          {headers.map((header, index) => (
            <th key={`header-${index}`} className="Spreadsheet__header">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={`row-${rowIndex}`} data-row={rowIndex}>
            <td className="Spreadsheet__header">{rowIndex + 1}</td>
            {row.cells.map((cell, colIndex) => 
              renderCell(cell, rowIndex, colIndex)
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CustomSpreadsheet;