# 11. AI & Genkit Integration

This document describes how Generative AI assists the Organization in document processing and storytelling.

## 1. Document Smart Scanners (OCR)

The **Extractor** module uses Google Gemini models via Genkit flows to parse unstructured data.

### Aadhaar / ID Scanner
- **Flow**: `extract-key-info-identity`
- **Output**: Full Name, ID Number, Address.
- **Usage**: Automatically populates beneficiary registration forms to reduce manual entry errors.

### Payment Receipt Scanner
- **Flow**: `scan-payment`
- **Output**: Transaction Amount, Reference ID (UTR), Date, UPI Handle.
- **Usage**: Speeds up donation entry by verifying screenshot details instantly.

### Medical Report Analyzer
- **Flow**: `extract-medical-findings`
- **Output**: Diagnosis, Key Observations, Urgency Stage.
- **Usage**: Helps staff quickly categorize medical cases for priority assignment.

## 2. Impact Story Generation

### Case Story Creator
- **Flow**: `create-lead-story`
- **Logic**: Analyzes multiple medical documents or descriptions.
- **Goal**: Generates a respectful, compelling narrative for the public fundraising page while preserving the dignity of the family.

### Academic Journey Summary
- **Flow**: `create-education-story`
- **Logic**: Synthesizes transcripts and marksheets.
- **Goal**: Summarizes a student's achievements and financial need for potential educational donors.

## 3. Configuration
- **Model**: `googleai/gemini-1.5-flash-latest` (Optimized for speed and high-fidelity text extraction).
- **Security**: Images are processed as Base64 data URIs and never stored by the AI provider.

---
[**◄ Back to Index**](./README.md)