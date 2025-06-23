import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { updateCell } from '../../store/slices/excelSlice';

const CellEditor = ({ 
  rowId, 
  cellIndex, 
  initialValue, 
  cellType, 
  onClose,
  position 
}) => {
  const dispatch = useDispatch();
  const [value, setValue] = useState(initialValue || '');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Validate input based on cell type
  const validateInput = (val, type) => {
    switch (type) {
      case 'number':
        if (val && !val.match(/^\d+\.?\d*$/)) {
          return 'Please enter a valid number';
        }
        break;
      case 'currency':
        if (val && !val.match(/^\$?\d+\.?\d{0,2}$/)) {
          return 'Please enter a valid currency amount (e.g., $100.00)';
        }
        break;
      case 'date':
        if (val && !val.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          return 'Please enter a valid date (MM/DD/YYYY)';
        }
        break;
      default:
        return '';
    }
    return '';
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    const validationError = validateInput(newValue, cellType);
    setError(validationError);
  };

  const handleSubmit = () => {
    if (!error) {
      dispatch(updateCell({
        rowId,
        cellIndex,
        value: formatValue(value, cellType)
      }));
      onClose();
    }
  };

  const formatValue = (val, type) => {
    if (!val) return '';
    
    switch (type) {
      case 'currency':
        // Ensure currency format
        if (!val.startsWith('$')) {
          return `$${val}`;
        }
        return val;
      case 'number':
        // Remove any non-numeric characters
        return val.replace(/[^\d.]/g, '');
      default:
        return val;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="cell-editor-container"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        className={`cell-editor-input ${error ? 'error' : ''}`}
        placeholder={getPlaceholder(cellType)}
      />
      {error && (
        <div className="cell-editor-error">
          {error}
        </div>
      )}
    </div>
  );
};

const getPlaceholder = (type) => {
  switch (type) {
    case 'number':
      return 'Enter number...';
    case 'currency':
      return '$0.00';
    case 'date':
      return 'MM/DD/YYYY';
    default:
      return 'Enter text...';
  }
};

export default CellEditor;