import React, { useState, useEffect, useRef } from 'react';

const HighlightOverlay = ({ 
  canvasRef,
  highlights = [],
  activeHighlight = null,
  onHighlightClick,
  onSelectionComplete,
  scale = 1.0,
  isSelecting = false
}) => {
  const overlayRef = useRef(null);
  const [selection, setSelection] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);

  useEffect(() => {
    if (!canvasRef?.current || !overlayRef.current) return;
    
    // Match overlay dimensions to canvas
    const canvas = canvasRef.current;
    overlayRef.current.style.width = `${canvas.width}px`;
    overlayRef.current.style.height = `${canvas.height}px`;
  }, [canvasRef, scale]);

  const getCoordinates = (e) => {
    if (!overlayRef.current) return null;
    
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e) => {
    if (!isSelecting) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setIsDrawing(true);
    setStartPoint(coords);
    setSelection({
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0
    });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !startPoint) return;
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    setSelection({
      x: Math.min(startPoint.x, coords.x),
      y: Math.min(startPoint.y, coords.y),
      width: Math.abs(coords.x - startPoint.x),
      height: Math.abs(coords.y - startPoint.y)
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !selection) return;
    
    setIsDrawing(false);
    
    // Only complete selection if it has meaningful size
    if (selection.width > 5 && selection.height > 5) {
      // Convert pixel coordinates to PDF coordinates
      const pdfCoords = {
        x: selection.x / scale,
        y: selection.y / scale,
        width: selection.width / scale,
        height: selection.height / scale,
        page: 1 // This should come from PDFViewer
      };
      
      if (onSelectionComplete) {
        onSelectionComplete(pdfCoords);
      }
    }
    
    setSelection(null);
    setStartPoint(null);
  };

  const renderHighlight = (highlight, index) => {
    const { x, y, width, height, color = 'rgba(255, 235, 59, 0.4)', label } = highlight;
    
    // Convert PDF coordinates to pixel coordinates
    const pixelCoords = {
      x: x * scale,
      y: y * scale,
      width: width * scale,
      height: height * scale
    };

    const isActive = activeHighlight === highlight.id;
    
    return (
      <div
        key={highlight.id || index}
        className="absolute border-2 transition-all duration-200 cursor-pointer group"
        style={{
          left: `${pixelCoords.x}px`,
          top: `${pixelCoords.y}px`,
          width: `${pixelCoords.width}px`,
          height: `${pixelCoords.height}px`,
          backgroundColor: color,
          borderColor: isActive ? 'rgb(59, 130, 246)' : 'transparent',
          borderStyle: isActive ? 'solid' : 'dashed',
          zIndex: isActive ? 10 : 1
        }}
        onClick={() => onHighlightClick && onHighlightClick(highlight)}
      >
        {label && (
          <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={overlayRef}
      className="absolute top-0 left-0 pointer-events-auto"
      style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Render existing highlights */}
      {highlights.map((highlight, index) => renderHighlight(highlight, index))}
      
      {/* Render current selection */}
      {selection && isDrawing && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-30"
          style={{
            left: `${selection.x}px`,
            top: `${selection.y}px`,
            width: `${selection.width}px`,
            height: `${selection.height}px`,
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
};

export default HighlightOverlay;