"""
PDF Processing Engine for extracting data from PDF files.
Supports text extraction, table detection, and confidence scoring.
"""

import os
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging

# PDF processing libraries
import pdfplumber
from PyPDF2 import PdfReader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BoundingBox:
    """Represents the location of extracted text on a page."""
    x0: float
    y0: float
    x1: float
    y1: float
    page: int


@dataclass
class ExtractedField:
    """Represents a single extracted field from the PDF."""
    name: str
    value: str
    confidence: float
    location: Optional[BoundingBox] = None
    page: int = 1
    method: str = 'text'  # 'text', 'ocr', 'table'


@dataclass
class ExtractionResult:
    """Contains all extracted data from a PDF."""
    fields: List[ExtractedField] = field(default_factory=list)
    confidence: float = 0.0
    page_count: int = 0
    processing_time: float = 0.0
    filename: str = ""
    status: str = "pending"  # pending, processing, completed, error
    error_message: Optional[str] = None


class PDFProcessor:
    """Main class for processing PDF documents."""
    
    # Common patterns for field detection
    PATTERNS = {
        'check_number': r'#?\s*(\d{4,})',
        'date': r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})',
        'amount': r'\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
        'phone': r'(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})',
        'email': r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    }
    
    def __init__(self):
        """Initialize the PDF processor."""
        self.current_result = None
        
    def process_pdf(self, file_path: str) -> ExtractionResult:
        """
        Process a PDF file and extract relevant data.
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            ExtractionResult with extracted data
        """
        start_time = datetime.now()
        result = ExtractionResult(filename=os.path.basename(file_path))
        
        try:
            result.status = "processing"
            
            # Extract text using pdfplumber (primary method)
            extracted_data = self._extract_with_pdfplumber(file_path)
            
            # If pdfplumber fails, fallback to PyPDF2
            if not extracted_data['text']:
                logger.info("Falling back to PyPDF2 for extraction")
                extracted_data = self._extract_with_pypdf2(file_path)
            
            # If both methods fail, raise an error
            if not extracted_data['text'] and extracted_data['page_count'] == 0:
                raise ValueError("Unable to extract text from PDF")
            
            result.page_count = extracted_data['page_count']
            
            # Extract fields from the text
            for page_num, page_text in enumerate(extracted_data['pages'], 1):
                fields = self._extract_fields_from_text(page_text, page_num)
                result.fields.extend(fields)
            
            # Calculate overall confidence
            if result.fields:
                result.confidence = sum(f.confidence for f in result.fields) / len(result.fields)
            
            result.status = "completed"
            
        except Exception as e:
            logger.error(f"Error processing PDF: {str(e)}")
            result.status = "error"
            result.error_message = str(e)
        
        # Calculate processing time
        end_time = datetime.now()
        result.processing_time = (end_time - start_time).total_seconds()
        
        return result
    
    def _extract_with_pdfplumber(self, file_path: str) -> Dict[str, Any]:
        """Extract text using pdfplumber."""
        extracted = {
            'text': '',
            'pages': [],
            'page_count': 0
        }
        
        try:
            with pdfplumber.open(file_path) as pdf:
                extracted['page_count'] = len(pdf.pages)
                
                for page in pdf.pages:
                    page_text = page.extract_text() or ''
                    extracted['pages'].append(page_text)
                    extracted['text'] += page_text + '\n'
                    
        except Exception as e:
            logger.error(f"pdfplumber extraction failed: {str(e)}")
            
        return extracted
    
    def _extract_with_pypdf2(self, file_path: str) -> Dict[str, Any]:
        """Extract text using PyPDF2 as fallback."""
        extracted = {
            'text': '',
            'pages': [],
            'page_count': 0
        }
        
        try:
            with open(file_path, 'rb') as file:
                reader = PdfReader(file)
                extracted['page_count'] = len(reader.pages)
                
                for page in reader.pages:
                    page_text = page.extract_text() or ''
                    extracted['pages'].append(page_text)
                    extracted['text'] += page_text + '\n'
                    
        except Exception as e:
            logger.error(f"PyPDF2 extraction failed: {str(e)}")
            
        return extracted
    
    def _extract_fields_from_text(self, text: str, page_num: int) -> List[ExtractedField]:
        """Extract specific fields from text using patterns."""
        fields = []
        
        # Search for check numbers
        check_matches = re.findall(self.PATTERNS['check_number'], text)
        for match in check_matches:
            fields.append(ExtractedField(
                name='check_number',
                value=match,
                confidence=self._calculate_pattern_confidence('check_number', match),
                page=page_num,
                method='text'
            ))
        
        # Search for dates
        date_matches = re.findall(self.PATTERNS['date'], text)
        for match in date_matches:
            fields.append(ExtractedField(
                name='date',
                value=match,
                confidence=self._calculate_pattern_confidence('date', match),
                page=page_num,
                method='text'
            ))
        
        # Search for amounts
        amount_matches = re.findall(self.PATTERNS['amount'], text)
        for match in amount_matches:
            fields.append(ExtractedField(
                name='amount',
                value=match,
                confidence=self._calculate_pattern_confidence('amount', match),
                page=page_num,
                method='text'
            ))
        
        return fields
    
    def _calculate_pattern_confidence(self, field_type: str, value: str) -> float:
        """
        Calculate confidence score for a pattern match.
        
        Base Score = Pattern Match Score (0-40%)
        + Location Score (0-20%)  
        + Context Score (0-20%)
        + Clarity Score (0-20%)
        """
        # Base pattern match score
        pattern_score = 0.4  # Full points for regex match
        
        # Location score (simplified for now)
        location_score = 0.15  # Default middle value
        
        # Context score (simplified for now)
        context_score = 0.15  # Default middle value
        
        # Clarity score based on value characteristics
        clarity_score = 0.2
        if field_type == 'check_number' and len(value) < 4:
            clarity_score = 0.1
        elif field_type == 'amount' and '.' not in value:
            clarity_score = 0.15
        
        total_confidence = pattern_score + location_score + context_score + clarity_score
        return min(total_confidence, 1.0)  # Cap at 100%
    
    def extract_tables(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract tables from PDF (placeholder for Day 2)."""
        # TODO: Implement table extraction using camelot-py
        return []
    
    def apply_template(self, result: ExtractionResult, template: Dict[str, Any]) -> ExtractionResult:
        """Apply a template to improve extraction (placeholder for Day 4)."""
        # TODO: Implement template-based extraction
        return result