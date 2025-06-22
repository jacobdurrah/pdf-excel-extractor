import React, { useState } from 'react';
import PDFViewer from '../pdf/PDFViewer';
import ResizableDivider from './ResizableDivider';
import NavigationBar from '../common/NavigationBar';
import ExcelPreview from '../excel/ExcelPreview';

const MainLayout = () => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const container = e.currentTarget;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the width between 20% and 80%
    if (newWidth >= 20 && newWidth <= 80) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <NavigationBar />
      <div 
        className="flex flex-1 overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
      {/* Left Panel - PDF Viewer */}
      <div 
        className="relative bg-gray-100 overflow-hidden"
        style={{ width: `${leftPanelWidth}%` }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-800">PDF Document</h2>
          </div>
          
          {/* PDF Viewer Container */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            <PDFViewer />
          </div>
        </div>
      </div>

      {/* Resizable Divider */}
      <ResizableDivider 
        onMouseDown={handleMouseDown}
        isDragging={isDragging}
      />

      {/* Right Panel - Excel Preview */}
      <div 
        className="relative bg-white overflow-hidden"
        style={{ width: `${100 - leftPanelWidth}%` }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-800">Excel Preview</h2>
          </div>
          
          {/* Excel Preview Container */}
          <div className="flex-1 overflow-auto p-4">
            <ExcelPreview />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MainLayout;