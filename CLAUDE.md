# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This directory is named "pdf Extractor" but currently contains no implementation. Based on the name and the presence of a sample PDF file, this appears to be intended for PDF extraction/processing functionality.

## Current Contents

- One PDF file: `Check-EFTInfo - 2023-11-15T055920.964.pdf` (likely a sample input file)
- Claude CLI configuration in `.claude/` directory

## Development Notes

Since this is an empty project, when implementing PDF extraction functionality, consider:

1. The sample PDF file appears to be financial/check information, suggesting the tool may need to handle structured financial data extraction
2. Common PDF extraction libraries to consider based on chosen language:
   - Python: PyPDF2, pdfplumber, PDFMiner
   - JavaScript/Node: pdf-parse, pdf.js
   - Java: Apache PDFBox, iText

## Getting Started

This project has no code yet. To begin development:

1. Choose implementation language
2. Initialize project with appropriate package manager
3. Add PDF processing dependencies
4. Implement extraction logic using the sample PDF as test input