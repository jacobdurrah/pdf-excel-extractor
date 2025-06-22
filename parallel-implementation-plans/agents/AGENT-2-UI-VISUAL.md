# Agent 2: UI Components & Visual Flow

## Mission
Build the visual interface that creates trust through step-by-step extraction with clear visual feedback.

## Key Responsibilities
1. Split-screen PDF viewer and Excel preview
2. Visual highlighting and selection
3. Animated arrows showing data flow
4. Step-by-step extraction interface
5. Confidence indicators and progress tracking

## Day-by-Day Plan

### Day 1: Core Layout & Components
- [ ] Check Node.js version (accept 16+ if available)
- [ ] Install dependencies with fallbacks:
  - Try: `cd frontend && npm install`
  - Handle any version conflicts gracefully
- [ ] Create component directories if missing
- [ ] Create `frontend/src/components/MainLayout.jsx` with split-screen
- [ ] Implement `PDFViewer` component using PDF.js
- [ ] Build resizable divider between panels
- [ ] Set up basic navigation and controls
- [ ] Create mock data for testing
- [ ] Update STATUS.md with any environment adaptations

### Day 2: PDF Viewer Features
- [ ] Implement zoom controls (25% - 200%)
- [ ] Add page navigation
- [ ] Create `HighlightOverlay` component for selections
- [ ] Build coordinate mapping system for highlights
- [ ] Add pan and scroll functionality
- [ ] Update STATUS.md

### Day 3: Visual Feedback System
- [ ] Create `AnimatedArrow` component with CSS animations
- [ ] Build `ConfidenceIndicator` component (color-coded)
- [ ] Implement `ExtractionFlow` visualization
- [ ] Add progress bars and status indicators
- [ ] Create loading and processing animations
- [ ] Update STATUS.md

### Day 4: Step-by-Step Interface
- [ ] Build `StepExtraction` component
- [ ] Create field navigation system
- [ ] Implement approve/reject/edit controls
- [ ] Add keyboard shortcuts (Enter to confirm, Tab to skip)
- [ ] Build extraction history sidebar
- [ ] Update STATUS.md

### Day 5: Polish & Responsive Design
- [ ] Implement dark mode toggle
- [ ] Ensure responsive layout for different screens
- [ ] Add tooltips and help text
- [ ] Create onboarding overlay for first-time users
- [ ] Optimize performance and animations
- [ ] Final STATUS.md update

## Technical Specifications

### Component Architecture
```
src/components/
├── layout/
│   ├── MainLayout.jsx
│   ├── SplitScreen.jsx
│   └── ResizableDivider.jsx
├── pdf/
│   ├── PDFViewer.jsx
│   ├── HighlightOverlay.jsx
│   └── PageControls.jsx
├── extraction/
│   ├── StepExtraction.jsx
│   ├── ExtractionControls.jsx
│   └── FieldNavigator.jsx
├── visual/
│   ├── AnimatedArrow.jsx
│   ├── ConfidenceIndicator.jsx
│   └── ProgressTracker.jsx
└── common/
    ├── Button.jsx
    ├── Modal.jsx
    └── Tooltip.jsx
```

### State Management (Redux)
```javascript
const uiSlice = {
  viewMode: 'step-by-step', // or 'batch'
  currentField: 0,
  highlights: [],
  zoom: 100,
  darkMode: false,
  showOnboarding: true
}

const extractionSlice = {
  session: null,
  fields: [],
  currentFieldIndex: 0,
  history: [],
  confidence: {}
}
```

### Visual Specifications

#### Animated Arrow
```css
@keyframes arrow-flow {
  0% { transform: translateX(0); opacity: 0.3; }
  50% { transform: translateX(20px); opacity: 1; }
  100% { transform: translateX(40px); opacity: 0.3; }
}
```

#### Confidence Colors
- High (>90%): `#10B981` (green)
- Medium (70-90%): `#F59E0B` (yellow)  
- Low (<70%): `#EF4444` (red)

## Integration Points

### With Agent 5 (IPC Bridge)
- Send extraction requests via IPC
- Receive field highlights and values
- Handle progress updates
- Display extraction results

### Mock Data Structure
```javascript
const mockExtraction = {
  fields: [
    {
      id: 'field-1',
      name: 'Check Number',
      value: '1234',
      confidence: 0.98,
      bounds: { x: 100, y: 100, width: 100, height: 30 },
      status: 'pending' // or 'approved', 'rejected', 'edited'
    }
  ]
}
```

## Styling Guidelines
- Use Tailwind CSS classes
- Follow existing design system
- Smooth transitions (200ms default)
- Consistent spacing (4px grid)
- Accessibility: WCAG 2.1 AA compliant

## Success Criteria
- [ ] Split-screen layout works smoothly
- [ ] PDF rendering is fast and clear
- [ ] Highlights appear correctly on PDF
- [ ] Arrows animate smoothly
- [ ] Step-by-step flow is intuitive
- [ ] Responsive on 1366x768 and up
- [ ] All animations under 60fps
- [ ] Ready for integration by Day 5

## Daily Status Updates
Create `/parallel-implementation-plans/status/AGENT-2-STATUS.md` and update daily with:
- Components completed
- UI/UX decisions made
- Screenshots of progress
- Integration readiness