import React from 'react';

export const cellValidationRules = {
  text: {
    pattern: /.*/,
    format: null,
    validate: (value) => ({ isValid: true, value })
  },
  number: {
    pattern: /^\d+\.?\d*$/,
    format: '#,##0.00',
    validate: (value) => {
      const cleaned = value.toString().replace(/[^\d.]/g, '');
      const isValid = /^\d+\.?\d*$/.test(cleaned);
      return { 
        isValid, 
        value: isValid ? cleaned : value,
        error: isValid ? null : 'Invalid number format'
      };
    }
  },
  currency: {
    pattern: /^\$?\d+\.?\d{0,2}$/,
    format: '$#,##0.00',
    validate: (value) => {
      const cleaned = value.toString().replace(/[^\d.]/g, '');
      const isValid = /^\d+\.?\d{0,2}$/.test(cleaned);
      const formatted = isValid && cleaned ? `$${parseFloat(cleaned).toFixed(2)}` : value;
      return { 
        isValid, 
        value: formatted,
        error: isValid ? null : 'Invalid currency format'
      };
    }
  },
  date: {
    pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    format: 'MM/DD/YYYY',
    validate: (value) => {
      const isValid = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value);
      if (isValid) {
        const [month, day, year] = value.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const isValidDate = date.getMonth() === month - 1 && 
                          date.getDate() === day && 
                          date.getFullYear() === year;
        return {
          isValid: isValidDate,
          value,
          error: isValidDate ? null : 'Invalid date'
        };
      }
      return {
        isValid: false,
        value,
        error: 'Date format must be MM/DD/YYYY'
      };
    }
  },
  formula: {
    pattern: /^=.*/,
    format: null,
    validate: (value) => {
      const isFormula = value.toString().startsWith('=');
      return {
        isValid: isFormula,
        value,
        error: isFormula ? null : 'Formulas must start with ='
      };
    }
  }
};

export const detectCellType = (value) => {
  if (typeof value !== 'string') return 'text';
  
  // Check for formula
  if (value.startsWith('=')) return 'formula';
  
  // Check for currency
  if (value.match(/^\$[\d,]+\.?\d{0,2}$/)) return 'currency';
  
  // Check for date
  if (value.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) return 'date';
  
  // Check for number
  if (value.match(/^[\d,]+\.?\d*$/)) return 'number';
  
  return 'text';
};

export const formatCellValue = (value, type) => {
  if (!value) return '';
  
  switch (type) {
    case 'currency':
      const numValue = parseFloat(value.toString().replace(/[^\d.]/g, ''));
      return isNaN(numValue) ? value : `$${numValue.toFixed(2)}`;
    
    case 'number':
      const num = parseFloat(value.toString().replace(/[^\d.]/g, ''));
      return isNaN(num) ? value : num.toLocaleString('en-US');
    
    case 'date':
      // Ensure proper date format
      return value;
    
    default:
      return value;
  }
};

const DataValidation = ({ value, type, onChange, onError }) => {
  const handleValidation = (inputValue) => {
    const rule = cellValidationRules[type] || cellValidationRules.text;
    const result = rule.validate(inputValue);
    
    if (result.isValid) {
      onChange(result.value);
      onError(null);
    } else {
      onError(result.error);
    }
    
    return result;
  };

  return null; // This is a utility component
};

export default DataValidation;