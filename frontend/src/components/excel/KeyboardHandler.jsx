import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  selectCell, 
  updateCell, 
  undo, 
  redo,
  setCopiedCells,
  pasteCells,
  setEditingCell 
} from '../../store/slices/excelSlice';

const KeyboardHandler = ({ onStartEdit }) => {
  const dispatch = useDispatch();
  const { selectedCell, rows, copiedCells } = useSelector(state => state.excel);

  const handleKeyNavigation = useCallback((e) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;
    let newRow = row;
    let newCol = col;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newRow = Math.max(0, row - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newRow = Math.min(rows.length - 1, row + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newCol = Math.max(0, col - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newCol = Math.min(4, col + 1); // Assuming 5 columns (A-E)
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Move left
          if (col > 0) {
            newCol = col - 1;
          } else if (row > 0) {
            newRow = row - 1;
            newCol = 4;
          }
        } else {
          // Move right
          if (col < 4) {
            newCol = col + 1;
          } else if (row < rows.length - 1) {
            newRow = row + 1;
            newCol = 0;
          }
        }
        break;
      case 'Enter':
        if (e.shiftKey) {
          // Move up
          newRow = Math.max(0, row - 1);
        } else {
          // Move down
          newRow = Math.min(rows.length - 1, row + 1);
        }
        break;
      case 'Home':
        e.preventDefault();
        if (e.ctrlKey) {
          // Go to first cell
          newRow = 0;
          newCol = 0;
        } else {
          // Go to first column in current row
          newCol = 0;
        }
        break;
      case 'End':
        e.preventDefault();
        if (e.ctrlKey) {
          // Go to last cell with data
          newRow = rows.length - 1;
          newCol = 4;
        } else {
          // Go to last column in current row
          newCol = 4;
        }
        break;
      default:
        return;
    }

    if (newRow !== row || newCol !== col) {
      dispatch(selectCell({ row: newRow, col: newCol }));
    }
  }, [selectedCell, rows, dispatch]);

  const handleCopyPaste = useCallback((e) => {
    if (!selectedCell) return;

    // Copy (Ctrl+C or Cmd+C)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
      e.preventDefault();
      const { row, col } = selectedCell;
      if (rows[row] && rows[row].cells[col]) {
        const cellData = rows[row].cells[col];
        dispatch(setCopiedCells([{
          row,
          col,
          value: cellData.value,
          type: cellData.type
        }]));
        
        // Also copy to clipboard
        navigator.clipboard.writeText(cellData.value);
      }
    }

    // Paste (Ctrl+V or Cmd+V)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
      e.preventDefault();
      if (copiedCells && copiedCells.length > 0) {
        dispatch(pasteCells({
          targetRow: selectedCell.row,
          targetCol: selectedCell.col
        }));
      }
    }

    // Cut (Ctrl+X or Cmd+X)
    if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey) {
      e.preventDefault();
      const { row, col } = selectedCell;
      if (rows[row] && rows[row].cells[col]) {
        const cellData = rows[row].cells[col];
        dispatch(setCopiedCells([{
          row,
          col,
          value: cellData.value,
          type: cellData.type,
          cut: true
        }]));
        
        // Clear the cell
        dispatch(updateCell({
          rowId: rows[row].id,
          cellIndex: col,
          value: ''
        }));
        
        // Copy to clipboard
        navigator.clipboard.writeText(cellData.value);
      }
    }
  }, [selectedCell, rows, copiedCells, dispatch]);

  const handleEditShortcuts = useCallback((e) => {
    if (!selectedCell) return;

    // F2 to edit
    if (e.key === 'F2') {
      e.preventDefault();
      onStartEdit(selectedCell.row, selectedCell.col);
    }

    // Delete to clear cell
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const { row, col } = selectedCell;
      if (rows[row] && rows[row].cells[col] && rows[row].cells[col].editable !== false) {
        dispatch(updateCell({
          rowId: rows[row].id,
          cellIndex: col,
          value: ''
        }));
      }
    }

    // Any printable character starts editing
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      onStartEdit(selectedCell.row, selectedCell.col, e.key);
    }
  }, [selectedCell, rows, dispatch, onStartEdit]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle undo/redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch(redo());
        return;
      }

      // Handle other keyboard actions
      handleKeyNavigation(e);
      handleCopyPaste(e);
      handleEditShortcuts(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyNavigation, handleCopyPaste, handleEditShortcuts, dispatch]);

  return null;
};

export default KeyboardHandler;