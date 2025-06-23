import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateCell } from '../../store/slices/excelSlice';

const FormulaBar = () => {
  const dispatch = useDispatch();
  const { rows, selectedCell } = useSelector(state => state.excel);
  const [formulaValue, setFormulaValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Update formula bar when cell selection changes
  useEffect(() => {
    if (selectedCell && rows[selectedCell.row] && rows[selectedCell.row].cells[selectedCell.col]) {
      const cellValue = rows[selectedCell.row].cells[selectedCell.col].value || '';
      setFormulaValue(cellValue);
      setIsEditing(false);
    } else {
      setFormulaValue('');
    }
  }, [selectedCell, rows]);

  const handleFormulaChange = (e) => {
    setFormulaValue(e.target.value);
  };

  const handleFormulaSubmit = () => {
    if (selectedCell && rows[selectedCell.row]) {
      dispatch(updateCell({
        rowId: rows[selectedCell.row].id,
        cellIndex: selectedCell.col,
        value: formulaValue
      }));
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFormulaSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Reset to original value
      if (selectedCell && rows[selectedCell.row] && rows[selectedCell.row].cells[selectedCell.col]) {
        setFormulaValue(rows[selectedCell.row].cells[selectedCell.col].value || '');
      }
      setIsEditing(false);
    }
  };

  const getCellReference = () => {
    if (!selectedCell) return '';
    const colLetter = String.fromCharCode(65 + selectedCell.col);
    const rowNumber = selectedCell.row + 1;
    return `${colLetter}${rowNumber}`;
  };

  return (
    <div className="formula-bar">
      <div className="formula-bar-cell-ref">
        {getCellReference()}
      </div>
      <div className="formula-bar-separator"></div>
      <div className="formula-bar-fx">fx</div>
      <input
        type="text"
        className="formula-bar-input"
        value={formulaValue}
        onChange={handleFormulaChange}
        onFocus={() => setIsEditing(true)}
        onBlur={handleFormulaSubmit}
        onKeyDown={handleKeyDown}
        placeholder={selectedCell ? "Enter value or formula..." : "Select a cell"}
        disabled={!selectedCell}
      />
    </div>
  );
};

export default FormulaBar;