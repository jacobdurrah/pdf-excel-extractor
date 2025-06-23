"""Unit tests for the PDF processor module."""

import unittest
import os
import tempfile
from unittest.mock import Mock, patch, mock_open, PropertyMock
from app.services.pdf_processor import (
    PDFProcessor, ExtractionResult, ExtractedField, BoundingBox
)


class TestDataModels(unittest.TestCase):
    """Test data model classes."""
    
    def test_bounding_box_creation(self):
        """Test BoundingBox creation."""
        bbox = BoundingBox(x0=0, y0=0, x1=100, y1=50, page=1)
        self.assertEqual(bbox.x0, 0)
        self.assertEqual(bbox.y0, 0)
        self.assertEqual(bbox.x1, 100)
        self.assertEqual(bbox.y1, 50)
        self.assertEqual(bbox.page, 1)
    
    def test_extracted_field_creation(self):
        """Test ExtractedField creation."""
        field = ExtractedField(
            name='check_number',
            value='1234',
            confidence=0.95,
            page=1,
            method='text'
        )
        self.assertEqual(field.name, 'check_number')
        self.assertEqual(field.value, '1234')
        self.assertEqual(field.confidence, 0.95)
        self.assertEqual(field.page, 1)
        self.assertEqual(field.method, 'text')
    
    def test_extraction_result_creation(self):
        """Test ExtractionResult creation."""
        result = ExtractionResult()
        self.assertEqual(result.fields, [])
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.page_count, 0)
        self.assertEqual(result.processing_time, 0.0)
        self.assertEqual(result.status, 'pending')
        self.assertIsNone(result.error_message)


class TestPDFProcessor(unittest.TestCase):
    """Test PDFProcessor class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.processor = PDFProcessor()
    
    def test_pattern_matching(self):
        """Test regex patterns."""
        import re
        
        # Test check number pattern
        text = "Check #1234"
        match = self.processor.PATTERNS['check_number']
        result = re.search(match, text)
        self.assertIsNotNone(result)
        self.assertEqual(result.group(1), '1234')
        
        # Test date patterns (now a list)
        date_tests = [
            ("Date: 12/31/2023", "12/31/2023"),
            ("Date: 2023-12-31", "2023-12-31"),
            ("Date: January 15, 2024", "January 15, 2024"),
            ("Date: 15 March 2024", "15 March 2024")
        ]
        for text, expected in date_tests:
            found = False
            for pattern in self.processor.PATTERNS['date']:
                result = re.search(pattern, text, re.IGNORECASE)
                if result:
                    found = True
                    break
            self.assertTrue(found, f"Failed to match date in: {text}")
        
        # Test amount patterns (now a list)
        amount_tests = [
            ("Total: $1,234.56", "1,234.56"),
            ("Amount: 999.99", "999.99"),
            ("1,234.56 USD", "1,234.56")
        ]
        for text, expected in amount_tests:
            found = False
            for pattern in self.processor.PATTERNS['amount']:
                result = re.search(pattern, text)
                if result:
                    found = True
                    self.assertEqual(result.group(1), expected)
                    break
            self.assertTrue(found, f"Failed to match amount in: {text}")
    
    def test_confidence_calculation(self):
        """Test confidence score calculation."""
        # Test check number confidence
        conf = self.processor._calculate_pattern_confidence('check_number', '12345')
        self.assertGreater(conf, 0.0)
        self.assertLessEqual(conf, 1.0)
        
        # Test short check number gets lower confidence
        conf_short = self.processor._calculate_pattern_confidence('check_number', '123')
        conf_long = self.processor._calculate_pattern_confidence('check_number', '12345')
        self.assertLess(conf_short, conf_long)
        
        # Test amount confidence
        conf_with_decimal = self.processor._calculate_pattern_confidence('amount', '123.45')
        conf_without_decimal = self.processor._calculate_pattern_confidence('amount', '123')
        self.assertGreater(conf_with_decimal, conf_without_decimal)
        
        # Test context improves confidence
        context = "Check Number: 12345\nDate: 12/31/2023\nAmount: $500.00"
        conf_with_context = self.processor._calculate_pattern_confidence('check_number', '12345', context)
        conf_without_context = self.processor._calculate_pattern_confidence('check_number', '12345', '')
        self.assertGreaterEqual(conf_with_context, conf_without_context)
    
    def test_extract_fields_from_text(self):
        """Test field extraction from text."""
        sample_text = """
        Check #12345
        Date: 12/31/2023
        Amount: $1,234.56
        """
        
        fields = self.processor._extract_fields_from_text(sample_text, 1)
        
        # Should find at least one of each field type
        field_types = {field.name for field in fields}
        self.assertIn('check_number', field_types)
        self.assertIn('date', field_types)
        self.assertIn('amount', field_types)
        
        # Check specific values
        check_fields = [f for f in fields if f.name == 'check_number']
        self.assertTrue(any(f.value == '12345' for f in check_fields))
        
        date_fields = [f for f in fields if f.name == 'date']
        self.assertTrue(any(f.value == '12/31/2023' for f in date_fields))
        
        amount_fields = [f for f in fields if f.name == 'amount']
        self.assertTrue(any(f.value == '1,234.56' for f in amount_fields))
    
    @patch('pdfplumber.open')
    def test_extract_with_pdfplumber_success(self, mock_pdf_open):
        """Test successful extraction with pdfplumber."""
        # Mock PDF pages
        mock_page = Mock()
        mock_page.extract_text.return_value = "Test text from page"
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=None)
        
        mock_pdf_open.return_value = mock_pdf
        
        result = self.processor._extract_with_pdfplumber('dummy.pdf')
        
        self.assertEqual(result['page_count'], 1)
        self.assertEqual(len(result['pages']), 1)
        self.assertIn('Test text from page', result['text'])
    
    @patch('pdfplumber.open')
    def test_extract_with_pdfplumber_failure(self, mock_pdf_open):
        """Test pdfplumber extraction failure handling."""
        mock_pdf_open.side_effect = Exception("PDF error")
        
        result = self.processor._extract_with_pdfplumber('dummy.pdf')
        
        self.assertEqual(result['text'], '')
        self.assertEqual(result['pages'], [])
        self.assertEqual(result['page_count'], 0)
    
    @patch('app.services.pdf_processor.open', new_callable=mock_open, read_data=b'dummy pdf data')
    @patch('app.services.pdf_processor.PdfReader')
    def test_extract_with_pypdf2_success(self, mock_reader_class, mock_file):
        """Test successful extraction with PyPDF2."""
        # Mock PDF reader
        mock_page = Mock()
        mock_page.extract_text.return_value = "PyPDF2 extracted text"
        
        mock_reader = Mock()
        mock_reader.pages = [mock_page]
        
        mock_reader_class.return_value = mock_reader
        
        result = self.processor._extract_with_pypdf2('dummy.pdf')
        
        self.assertEqual(result['page_count'], 1)
        self.assertEqual(len(result['pages']), 1)
        self.assertIn('PyPDF2 extracted text', result['text'])
    
    @patch('pdfplumber.open')
    @patch('builtins.open', new_callable=mock_open)
    @patch('PyPDF2.PdfReader')
    def test_process_pdf_complete_flow(self, mock_reader_class, mock_file, mock_pdf_open):
        """Test complete PDF processing flow."""
        # Setup pdfplumber mock
        mock_page = Mock()
        mock_page.extract_text.return_value = "Check #98765\nDate: 01/15/2024\nAmount: $500.00"
        
        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]
        mock_pdf.__enter__ = Mock(return_value=mock_pdf)
        mock_pdf.__exit__ = Mock(return_value=None)
        
        mock_pdf_open.return_value = mock_pdf
        
        # Process PDF
        result = self.processor.process_pdf('test.pdf')
        
        # Verify result
        self.assertEqual(result.status, 'completed')
        self.assertEqual(result.page_count, 1)
        self.assertGreater(len(result.fields), 0)
        self.assertGreater(result.confidence, 0)
        self.assertGreater(result.processing_time, 0)
        self.assertEqual(result.filename, 'test.pdf')
        
        # Check extracted fields
        field_names = {f.name for f in result.fields}
        self.assertIn('check_number', field_names)
        self.assertIn('date', field_names)
        self.assertIn('amount', field_names)
    
    def test_enhanced_field_detection(self):
        """Test enhanced field detection for financial data."""
        sample_text = """
        Pay to the order of: John Doe
        Account #: 123456789
        Routing Number: 987654321
        SSN: 123-45-6789
        Address: 123 Main Street
        """
        
        fields = self.processor._extract_fields_from_text(sample_text, 1)
        field_dict = {f.name: f.value for f in fields}
        
        # Check that new field types are detected
        self.assertIn('name', field_dict)
        self.assertIn('account_number', field_dict)
        self.assertIn('routing_number', field_dict)
        self.assertIn('ssn', field_dict)
        self.assertIn('address', field_dict)
    
    @patch('camelot.read_pdf')
    def test_extract_tables(self, mock_camelot):
        """Test table extraction functionality."""
        import pandas as pd
        
        # Mock table data
        mock_table = Mock()
        mock_table.df = pd.DataFrame({
            'Field': ['Check Number', 'Date', 'Amount'],
            'Value': ['12345', '12/31/2023', '$1,234.56']
        })
        mock_table.page = 1
        mock_table.accuracy = 0.95
        
        mock_camelot.return_value = [mock_table]
        
        tables = self.processor.extract_tables('dummy.pdf')
        
        self.assertEqual(len(tables), 1)
        self.assertEqual(tables[0]['page'], 1)
        self.assertEqual(tables[0]['accuracy'], 0.95)
        self.assertEqual(tables[0]['rows'], 3)
        self.assertEqual(tables[0]['columns'], 2)
    
    @patch('pdfplumber.open')
    def test_process_pdf_error_handling(self, mock_pdf_open):
        """Test error handling in PDF processing."""
        mock_pdf_open.side_effect = Exception("File not found")
        
        result = self.processor.process_pdf('nonexistent.pdf')
        
        self.assertEqual(result.status, 'error')
        self.assertIsNotNone(result.error_message)
        # The error message could be either the original error or our custom message
        self.assertTrue(
            'File not found' in result.error_message or 
            'Unable to extract text from PDF' in result.error_message
        )


class TestIntegration(unittest.TestCase):
    """Integration tests with actual PDF file."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.processor = PDFProcessor()
        self.test_pdf_path = "/Users/jacob/Documents/Projects/pdf Extractor/Check-EFTInfo - 2023-11-15T055920.964.pdf"
    
    def test_process_actual_pdf(self):
        """Test processing an actual PDF file if available."""
        if not os.path.exists(self.test_pdf_path):
            self.skipTest(f"Test PDF not found at {self.test_pdf_path}")
        
        result = self.processor.process_pdf(self.test_pdf_path)
        
        # Basic assertions
        self.assertEqual(result.status, 'completed')
        self.assertGreater(result.page_count, 0)
        self.assertGreater(len(result.fields), 0)
        self.assertGreater(result.confidence, 0)
        
        # Check that we extracted various field types
        field_types = {field.name for field in result.fields}
        expected_types = {'check_number', 'date', 'amount'}
        self.assertTrue(field_types.intersection(expected_types))


    def test_identify_field_type(self):
        """Test field type identification."""
        test_cases = [
            ('12345', 'check_number'),
            ('123-45-6789', 'ssn'),
            ('987654321', 'routing_number'),
            ('$1,234.56', 'amount'),
            ('12/31/2023', 'date'),
            ('user@example.com', 'email'),
            ('(555) 123-4567', 'phone')
        ]
        
        for value, expected_type in test_cases:
            field_type = self.processor._identify_field_type(value)
            self.assertEqual(field_type, expected_type, 
                           f"Failed to identify {value} as {expected_type}")


if __name__ == '__main__':
    unittest.main()