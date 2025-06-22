import React from 'react';

const ResizableDivider = ({ onMouseDown, isDragging }) => {
  return (
    <div
      className={`
        relative w-1 bg-gray-300 cursor-col-resize select-none
        hover:bg-blue-400 transition-colors duration-200
        ${isDragging ? 'bg-blue-500' : ''}
      `}
      onMouseDown={onMouseDown}
    >
      {/* Visual indicator */}
      <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
        <div className="w-1 h-8 bg-gray-400 rounded-full opacity-50" />
      </div>
    </div>
  );
};

export default ResizableDivider;