# Agent 1: PDF Processing Engine

## Mission
Build the core PDF processing engine that extracts data from PDFs with high accuracy and confidence scoring.

## Key Responsibilities
1. PDF parsing and text extraction
2. Table detection and extraction
3. OCR for scanned documents
4. Confidence scoring algorithm
5. Data structure design for extracted content

## Day-by-Day Plan

### Day 1: Setup & Basic Parsing
- [ ] Check Python version (accept 3.8+ if available)
- [ ] Install PDF processing dependencies with fallbacks:
  - Try: `cd backend && poetry install`
  - If Poetry not found: `pip install pdfplumber PyPDF2 openpyxl`
- [ ] Create `backend/app/services/pdf_processor.py`
- [ ] Implement basic PDF loading and text extraction
- [ ] Test with existing sample: `Check-EFTInfo - 2023-11-15T055920.964.pdf`
- [ ] Create data models for extraction results
- [ ] Write unit tests for basic functionality
- [ ] Update STATUS.md with progress and any environment issues

### Day 2: Advanced Extraction
- [ ] Implement table detection using camelot-py
- [ ] Create field detection algorithms for common patterns:
  - Check numbers (regex: `#?\d{4,}`)
  - Dates (multiple formats)
  - Currency amounts
  - Names and addresses
- [ ] Build confidence scoring system (0-100%)
- [ ] Handle multi-page PDFs
- [ ] Update STATUS.md

### Day 3: OCR Integration (Optional)
- [ ] Check if Tesseract is installed: `tesseract --version`
- [ ] If available: Integrate pytesseract for scanned PDFs
- [ ] If not available: 
  - Focus on text-based PDF extraction
  - Note in STATUS.md that OCR is pending
  - Provide Tesseract installation instructions
- [ ] Create fallback for non-OCR extraction
- [ ] Test with text-based PDFs first
- [ ] Update STATUS.md with OCR availability

### Day 4: Template System
- [ ] Design template data structure
- [ ] Create template matching algorithm
- [ ] Build learning system from user corrections
- [ ] Implement template storage (JSON format)
- [ ] Add template-based extraction
- [ ] Update STATUS.md

### Day 5: Optimization & Testing
- [ ] Optimize extraction speed
- [ ] Implement caching for repeated extractions
- [ ] Create comprehensive test suite
- [ ] Document all APIs and data structures
- [ ] Prepare for integration
- [ ] Final STATUS.md update

## Technical Specifications

### API Endpoints (to implement)
```python
POST /api/extract/upload
POST /api/extract/analyze
POST /api/extract/process
GET /api/extract/status/{session_id}
POST /api/extract/feedback  # For learning
```

### Data Models
```python
class ExtractionResult:
    fields: List[ExtractedField]
    confidence: float
    page_count: int
    processing_time: float
    
class ExtractedField:
    name: str
    value: str
    confidence: float
    location: BoundingBox
    page: int
    method: str  # 'text', 'ocr', 'table'
```

### Confidence Scoring Algorithm
```
Base Score = Pattern Match Score (0-40%)
+ Location Score (0-20%)  
+ Context Score (0-20%)
+ Clarity Score (0-20%)

Adjustments:
- OCR: -20% penalty
- User correction: Learn and adjust weights
```

## Integration Points

### With Agent 5 (IPC Bridge)
- Expose extraction API endpoints
- Handle file uploads via IPC
- Stream extraction progress
- Return structured JSON results

### Mock Data for Other Agents
Create `backend/app/mock_extraction.json`:
```json
{
  "status": "completed",
  "fields": [
    {
      "name": "check_number",
      "value": "1234",
      "confidence": 0.98,
      "page": 1
    }
  ]
}
```

## Dependencies
- No external APIs (security requirement)
- All processing must be local
- Memory usage must stay under 200MB per PDF
- Support PDF files up to 100MB

## Success Criteria
- [ ] Extract text with 95%+ accuracy
- [ ] Handle tables correctly
- [ ] OCR works on scanned documents
- [ ] Confidence scores are meaningful
- [ ] Processing < 1 second per page
- [ ] All tests pass
- [ ] Ready for integration by Day 5

## Daily Status Updates
Create `/parallel-implementation-plans/status/AGENT-1-STATUS.md` and update daily with:
- Completed tasks
- Current blockers
- Integration readiness
- Test results