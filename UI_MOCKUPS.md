# UI Mockups for PDF to Excel Extractor

## 1. Main Application Window

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ PDF to Excel Extractor                               [─][□][×]│
├─────────────────────────────────────────────────────────────┤
│ File  Edit  View  Tools  Help                               │
├─────────────────────────────────────────────────────────────┤
│ [Open PDF] [Extract All] [Settings]  Mode: [Step-by-Step ▼] │
├─────────────────────┬───────────────────────────────────────┤
│                     │                                        │
│   PDF VIEWER        │         EXCEL PREVIEW                 │
│                     │  ┌─────┬─────┬─────┬─────┬─────┐     │
│  ┌─────────────┐    │  │  A  │  B  │  C  │  D  │  E  │     │
│  │             │    │  ├─────┼─────┼─────┼─────┼─────┤     │
│  │   Check     │ ➜  │  │ 1   │     │     │     │     │     │
│  │   Info      │    │  ├─────┼─────┼─────┼─────┼─────┤     │
│  │  Document   │    │  │ 2   │     │     │     │     │     │
│  │             │    │  ├─────┼─────┼─────┼─────┼─────┤     │
│  └─────────────┘    │  │ 3   │     │     │     │     │     │
│                     │  └─────┴─────┴─────┴─────┴─────┘     │
│ Page 1 of 5  [◀][▶] │  Confidence: ████████░░ 85%          │
└─────────────────────┴───────────────────────────────────────┘
```

### Key Features
- Split screen with resizable divider
- PDF viewer on left with zoom/pan controls
- Excel preview on right with editable cells
- Visual arrow showing data flow
- Confidence indicator at bottom

## 2. Step-by-Step Extraction Mode

### Highlighting Current Field
```
┌─────────────────────────────────────────────────────────────┐
│ Extracting: Check Number                              Step 1/8│
├─────────────────────┬───────────────────────────────────────┤
│                     │                                        │
│  ┌─────────────┐    │  ┌─────┬─────────────────────┐       │
│  │╔═══════════╗│    │  │  A  │         B           │       │
│  │║Check #1234║│ ➜  │  ├─────┼─────────────────────┤       │
│  │╚═══════════╝│    │  │ 1   │ Check Number: 1234  │       │
│  │             │    │  └─────┴─────────────────────┘       │
│  │ Pay to:     │    │                                       │
│  │ John Doe    │    │  [✓ Confirm] [✗ Skip] [Edit Value]  │
│  └─────────────┘    │                                       │
│                     │  Confidence: ████████████ 98%         │
│                     │                                       │
│ Highlighted area    │  Next: Payee Name                    │
└─────────────────────┴───────────────────────────────────────┘
```

### User Actions
- **Confirm**: Accept extracted value and move to next field
- **Skip**: Skip this field and move to next
- **Edit Value**: Manually edit the extracted value

## 3. Batch Processing View

### Progress Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│ Batch Extraction Progress                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Processing 5 PDF files...                                  │
│                                                             │
│  File 1: Check-001.pdf  ████████████████████ Complete ✓    │
│  File 2: Check-002.pdf  ████████████████████ Complete ✓    │
│  File 3: Check-003.pdf  ████████░░░░░░░░░░░ 45%           │
│  File 4: Check-004.pdf  ░░░░░░░░░░░░░░░░░░░ Queued        │
│  File 5: Check-005.pdf  ░░░░░░░░░░░░░░░░░░░ Queued        │
│                                                             │
│  Overall Progress: ██████████░░░░░░░░ 52%                  │
│                                                             │
│  [⏸ Pause] [✗ Cancel]           Time Remaining: 2:34       │
└─────────────────────────────────────────────────────────────┘
```

## 4. Validation & Review Screen

### Side-by-Side Comparison
```
┌─────────────────────────────────────────────────────────────┐
│ Extraction Complete - Please Review                          │
├─────────────────────┬───────────────────────────────────────┤
│ Original PDF        │ Extracted Data                        │
│                     │                                       │
│ Check #: 1234       │ ┌─────────────┬─────────────┐       │
│ Date: 11/15/2023    │ │ Field       │ Value       │       │
│ Amount: $500.00     │ ├─────────────┼─────────────┤       │
│ Payee: John Doe     │ │ Check #     │ 1234    ✓   │       │
│                     │ │ Date        │ 11/15/23 ⚠  │       │
│ ┌─────────────┐     │ │ Amount      │ $500.00 ✓   │       │
│ │             │     │ │ Payee       │ John Doe ✓  │       │
│ │  [Source]   │     │ └─────────────┴─────────────┘       │
│ │             │     │                                       │
│ └─────────────┘     │ ⚠ 1 field needs review               │
│                     │                                       │
│                     │ [Accept All] [Review Issues] [Export]│
└─────────────────────┴───────────────────────────────────────┘

Legend: ✓ High confidence  ⚠ Needs review  ✗ Low confidence
```

## 5. Template Manager

### Template Configuration
```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                              [×]    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐                                             │
│ │ General     │  Extraction Templates                       │
│ │ Templates   │  ┌──────────────────────────────────┐      │
│ │ Security    │  │ ▼ Bank Check Template           │      │
│ │ Performance │  │   Fields: Check#, Date, Amount  │      │
│ │ About       │  │   Last used: Today              │      │
│ └─────────────┘  │                                 │      │
│                  │ ▼ Invoice Template              │      │
│                  │   Fields: Invoice#, Total, Tax  │      │
│                  │   Last used: Yesterday          │      │
│                  └──────────────────────────────────┘      │
│                                                             │
│                  [+ New Template] [Edit] [Delete]           │
│                                                             │
│                           [Cancel] [Save]                   │
└─────────────────────────────────────────────────────────────┘
```

## Design Principles

### Trust Building
1. **Visual Feedback**: Every action has clear visual response
2. **Confidence Scores**: Color-coded (Green >90%, Yellow 70-90%, Red <70%)
3. **Manual Override**: Users can always edit extracted values
4. **Progress Tracking**: Clear indication of what's happening

### Security Indicators
- 🔒 Lock icon when processing locally
- No network activity indicators
- Clear messaging about local-only processing

### Accessibility
- High contrast mode available
- Keyboard navigation support
- Screen reader compatible
- Tooltips for all actions

## Color Scheme

### Light Mode (Default)
- Background: #FFFFFF
- Text: #1A202C
- Primary: #3B82F6 (Blue)
- Success: #10B981 (Green)
- Warning: #F59E0B (Yellow)
- Error: #EF4444 (Red)

### Dark Mode
- Background: #1A202C
- Text: #F7FAFC
- Primary: #60A5FA (Light Blue)
- Success: #34D399 (Light Green)
- Warning: #FBBF24 (Light Yellow)
- Error: #F87171 (Light Red)