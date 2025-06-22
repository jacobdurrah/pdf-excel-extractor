import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PageControls from './PageControls';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDFViewer = ({ pdfUrl = null }) => {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mock PDF URL for testing
  const mockPdfUrl = '/test-data/sample.pdf';
  const url = pdfUrl || mockPdfUrl;

  useEffect(() => {
    loadPdf();
  }, [url]);

  useEffect(() => {
    if (pdf) {
      renderPage();
    }
  }, [pdf, currentPage, scale]);

  const loadPdf = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For testing, we'll use a mock message since we don't have a real PDF yet
      if (!pdfUrl) {
        setLoading(false);
        return;
      }

      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDocument = await loadingTask.promise;
      
      setPdf(pdfDocument);
      setTotalPages(pdfDocument.numPages);
      setLoading(false);
    } catch (err) {
      setError('Failed to load PDF');
      setLoading(false);
      console.error('PDF loading error:', err);
    }
  };

  const renderPage = async () => {
    if (!pdf || !canvasRef.current) return;

    try {
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Page rendering error:', err);
    }
  };

  const handleZoomIn = () => {
    if (scale < 2) {
      setScale(scale + 0.25);
    }
  };

  const handleZoomOut = () => {
    if (scale > 0.25) {
      setScale(scale - 0.25);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Mock display for testing
  if (!pdfUrl) {
    return (
      <div className="h-full flex flex-col">
        <PageControls
          currentPage={1}
          totalPages={1}
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          disabled={true}
        />
        <div className="flex-1 flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center p-8">
            <svg className="w-24 h-24 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17h6M9 13h6M9 9h4" />
            </svg>
            <p className="text-gray-600 text-lg font-medium mb-2">No PDF Loaded</p>
            <p className="text-gray-500 text-sm">Upload a PDF to begin extraction</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageControls
        currentPage={currentPage}
        totalPages={totalPages}
        scale={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onPreviousPage={handlePreviousPage}
        onNextPage={handleNextPage}
        disabled={loading}
      />
      
      <div className="flex-1 overflow-auto bg-white rounded-lg shadow-sm border border-gray-200">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500 text-center">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <div className="p-4 overflow-auto">
            <canvas ref={canvasRef} className="mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;