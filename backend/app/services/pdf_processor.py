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
from pathlib import Path

# PDF processing libraries
import pdfplumber
from PyPDF2 import PdfReader
import camelot
import pandas as pd

# Security integration
from ..security.security_wrapper import get_security

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
    
    # Enhanced patterns for field detection
    PATTERNS = {
        'check_number': r'(?:Check\s*#?|#)\s*(\d{4,})',
        'date': [
            r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',  # MM/DD/YYYY or MM-DD-YYYY
            r'(\d{4}[/-]\d{1,2}[/-]\d{1,2})',  # YYYY/MM/DD or YYYY-MM-DD
            r'(\w{3,9}\s+\d{1,2},?\s+\d{4})',  # Month DD, YYYY
            r'(\d{1,2}\s+\w{3,9}\s+\d{4})'  # DD Month YYYY
        ],
        'amount': [
            r'\$\s*(\d{1,3}(?:,\d{3})*\.\d{2})',  # $1,234.56
            r'(\d{1,3}(?:,\d{3})*\.\d{2})\s*(?:USD|\$)',  # 1,234.56 USD
            r'Amount:?\s*\$?\s*(\d{1,3}(?:,\d{3})*\.\d{2})'  # Amount: $1,234.56
        ],
        'phone': r'(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}',
        'email': r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        'ssn': r'\b\d{3}-\d{2}-\d{4}\b',
        'routing_number': r'\b\d{9}\b',
        'account_number': r'(?:Account|Acct)\s*#?:?\s*(\d{4,})',
        'name': r'(?:Pay to the order of|Payee|Name):?\s*([A-Za-z\s]+?)(?=\n|$|\s{2,})',
        'address': r'(?:Address|Street):?\s*(.+?)(?=\n|$)'
    }
    
    def __init__(self):
        """Initialize the PDF processor."""
        self.current_result = None
        self.security = get_security()
        self.session_id = None
        
    def process_pdf(self, file_path: str, session_id: Optional[str] = None) -> ExtractionResult:
        """
        Process a PDF file and extract relevant data.
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            ExtractionResult with extracted data
        """
        start_time = datetime.now()
        result = ExtractionResult(filename=os.path.basename(file_path))
        
        # Use security wrapper if session provided
        if session_id:
            self.session_id = session_id
            return self.security.process_with_security(
                session_id,
                Path(file_path),
                self._process_pdf_internal,
                action="extract"
            )
        
        # Direct processing without security (for backward compatibility)
        return self._process_pdf_internal(file_path)
    
    def _process_pdf_internal(self, file_path: str) -> ExtractionResult:
        """Internal PDF processing logic."""
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
            
            # Extract tables from the PDF
            tables = self.extract_tables(file_path)
            for table_data in tables:
                table_fields = self._extract_fields_from_table(table_data)
                result.fields.extend(table_fields)
            
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
        """Extract specific fields from text using enhanced patterns."""
        fields = []
        
        # Process each pattern type
        for field_type, patterns in self.PATTERNS.items():
            if isinstance(patterns, list):
                # Multiple patterns for this field type
                for pattern in patterns:
                    matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
                    for match in matches:
                        value = match if isinstance(match, str) else match[0]
                        confidence = self._calculate_pattern_confidence(field_type, value, text)
                        fields.append(ExtractedField(
                            name=field_type,
                            value=value.strip(),
                            confidence=confidence,
                            page=page_num,
                            method='text'
                        ))
            else:
                # Single pattern
                matches = re.findall(patterns, text, re.IGNORECASE | re.MULTILINE)
                for match in matches:
                    value = match if isinstance(match, str) else match[0]
                    confidence = self._calculate_pattern_confidence(field_type, value, text)
                    fields.append(ExtractedField(
                        name=field_type,
                        value=value.strip(),
                        confidence=confidence,
                        page=page_num,
                        method='text'
                    ))
        
        # Remove duplicates while keeping highest confidence
        unique_fields = {}
        for field in fields:
            key = (field.name, field.value)
            if key not in unique_fields or field.confidence > unique_fields[key].confidence:
                unique_fields[key] = field
        
        return list(unique_fields.values())
    
    def _calculate_pattern_confidence(self, field_type: str, value: str, context: str = '') -> float:
        """
        Calculate confidence score for a pattern match.
        
        Base Score = Pattern Match Score (0-40%)
        + Location Score (0-20%)  
        + Context Score (0-20%)
        + Clarity Score (0-20%)
        """
        # Base pattern match score (40%)
        pattern_score = 0.4  # Full points for regex match
        
        # Location score (20%) - check if value appears near keywords
        location_score = 0.0
        location_keywords = {
            'check_number': ['check', 'number', '#'],
            'date': ['date', 'dated', 'on'],
            'amount': ['amount', 'total', 'sum', '$'],
            'name': ['pay to', 'payee', 'name'],
            'account_number': ['account', 'acct'],
            'routing_number': ['routing', 'aba', 'rtn']
        }
        
        if field_type in location_keywords and context:
            # Check proximity to keywords
            value_pos = context.lower().find(value.lower())
            if value_pos >= 0:
                nearby_text = context[max(0, value_pos-50):value_pos+50].lower()
                for keyword in location_keywords[field_type]:
                    if keyword in nearby_text:
                        location_score = 0.2
                        break
        else:
            location_score = 0.1  # Default if no context
        
        # Context score (20%) - check surrounding text quality
        context_score = 0.15
        if context:
            # Check if value is part of a structured line
            lines = context.split('\n')
            for line in lines:
                if value in line:
                    # Line has clear structure (contains colons, labels)
                    if ':' in line or any(kw in line.lower() for kw in ['date', 'amount', 'check', 'pay']):
                        context_score = 0.2
                    break
        
        # Clarity score (20%) based on value characteristics
        clarity_score = 0.0
        
        if field_type == 'check_number':
            if len(value) >= 4 and value.isdigit():
                clarity_score = 0.2
            elif len(value) >= 3:
                clarity_score = 0.15
            else:
                clarity_score = 0.05
                
        elif field_type == 'date':
            # Valid date formats get full score
            if re.match(r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}', value):
                clarity_score = 0.2
            elif any(month in value.lower() for month in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']):
                clarity_score = 0.18
            else:
                clarity_score = 0.1
                
        elif field_type == 'amount':
            # Check for proper currency format
            if '.' in value and re.match(r'^\d{1,3}(,\d{3})*\.\d{2}$', value.replace('$', '').strip()):
                clarity_score = 0.2
            elif re.match(r'^\d+\.\d{2}$', value.replace('$', '').strip()):
                clarity_score = 0.18
            else:
                clarity_score = 0.1
                
        elif field_type == 'ssn':
            if re.match(r'^\d{3}-\d{2}-\d{4}$', value):
                clarity_score = 0.2
            else:
                clarity_score = 0.05
                
        elif field_type == 'routing_number':
            if len(value) == 9 and value.isdigit():
                clarity_score = 0.2
            else:
                clarity_score = 0.05
                
        else:
            # Default clarity for other field types
            clarity_score = 0.15
        
        total_confidence = pattern_score + location_score + context_score + clarity_score
        return round(min(total_confidence, 1.0), 2)  # Cap at 100% and round to 2 decimals
    
    def extract_tables(self, file_path: str) -> List[Dict[str, Any]]:
        """Extract tables from PDF using camelot-py."""
        tables_data = []
        
        try:
            # Try lattice mode first (for tables with visible borders)
            tables = camelot.read_pdf(file_path, pages='all', flavor='lattice')
            
            # If no tables found, try stream mode (for borderless tables)
            if len(tables) == 0:
                logger.info("No tables found with lattice mode, trying stream mode")
                tables = camelot.read_pdf(file_path, pages='all', flavor='stream')
            
            # Process each table
            for i, table in enumerate(tables):
                # Get DataFrame
                df = table.df
                
                # Get table metadata
                table_info = {
                    'table_index': i,
                    'page': table.page,
                    'accuracy': table.accuracy,
                    'data': df.to_dict('records'),
                    'rows': len(df),
                    'columns': len(df.columns)
                }
                
                tables_data.append(table_info)
                logger.info(f"Extracted table {i} from page {table.page} with {len(df)} rows")
                
        except Exception as e:
            logger.error(f"Error extracting tables with camelot: {str(e)}")
            # Fallback to pdfplumber table extraction
            try:
                tables_data = self._extract_tables_with_pdfplumber(file_path)
            except Exception as e2:
                logger.error(f"Fallback table extraction also failed: {str(e2)}")
        
        return tables_data
    
    def _extract_tables_with_pdfplumber(self, file_path: str) -> List[Dict[str, Any]]:
        """Fallback table extraction using pdfplumber."""
        tables_data = []
        
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                
                for i, table in enumerate(tables):
                    if table and len(table) > 0:
                        # Convert to DataFrame for consistency
                        df = pd.DataFrame(table[1:], columns=table[0] if len(table) > 0 else None)
                        
                        table_info = {
                            'table_index': i,
                            'page': page_num,
                            'accuracy': 0.7,  # Lower confidence for pdfplumber
                            'data': df.to_dict('records'),
                            'rows': len(df),
                            'columns': len(df.columns)
                        }
                        
                        tables_data.append(table_info)
        
        return tables_data
    
    def _extract_fields_from_table(self, table_data: Dict[str, Any]) -> List[ExtractedField]:
        """Extract fields from table data."""
        fields = []
        page_num = table_data['page']
        accuracy = table_data['accuracy']
        
        # Look for key-value pairs in tables
        for row in table_data['data']:
            # Convert row values to strings
            row_values = {str(k): str(v) for k, v in row.items() if v}
            
            # Check each cell for patterns
            for col_name, value in row_values.items():
                if not value or value.lower() in ['', 'none', 'null', 'n/a']:
                    continue
                
                # Try to identify field type based on value
                field_type = self._identify_field_type(value)
                
                if field_type:
                    # Adjust confidence based on table accuracy
                    base_confidence = self._calculate_pattern_confidence(field_type, value)
                    adjusted_confidence = base_confidence * (0.8 + 0.2 * accuracy)
                    
                    fields.append(ExtractedField(
                        name=field_type,
                        value=value.strip(),
                        confidence=round(adjusted_confidence, 2),
                        page=page_num,
                        method='table'
                    ))
        
        return fields
    
    def _identify_field_type(self, value: str) -> Optional[str]:
        """Identify the field type based on value patterns."""
        value = value.strip()
        
        # Check each pattern type
        for field_type, patterns in self.PATTERNS.items():
            if isinstance(patterns, list):
                for pattern in patterns:
                    if re.match(pattern, value, re.IGNORECASE):
                        return field_type
            else:
                if re.match(patterns, value, re.IGNORECASE):
                    return field_type
        
        return None
    
    def apply_template(self, result: ExtractionResult, template: Dict[str, Any]) -> ExtractionResult:
        """Apply a template to improve extraction (placeholder for Day 4)."""
        # TODO: Implement template-based extraction
        return result