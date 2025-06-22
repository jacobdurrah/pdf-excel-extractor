#!/bin/bash

echo "PDF to Excel Extractor - Coordinator Startup Check"
echo "================================================="
echo ""

# Check Python
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
    echo "✅ Found: $PYTHON_VERSION"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
    echo "✅ Found: $PYTHON_VERSION"
else
    echo "❌ Python not found - Agents will provide installation instructions"
fi

# Check Node.js
echo ""
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Found: Node.js $NODE_VERSION"
else
    echo "❌ Node.js not found - Agents will provide installation instructions"
fi

# Check Tesseract (Optional)
echo ""
echo "Checking Tesseract OCR (optional)..."
if command -v tesseract &> /dev/null; then
    TESS_VERSION=$(tesseract --version 2>&1 | head -n 1)
    echo "✅ Found: $TESS_VERSION"
else
    echo "ℹ️  Tesseract not found - OCR features will be optional"
fi

# Check Git
echo ""
echo "Checking Git..."
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo "✅ Found: $GIT_VERSION"
fi

# Check sample PDF
echo ""
echo "Checking sample PDF..."
if [ -f "Check-EFTInfo - 2023-11-15T055920.964.pdf" ]; then
    echo "✅ Found sample PDF"
    # Copy to test directory
    mkdir -p test-data/samples
    cp "Check-EFTInfo - 2023-11-15T055920.964.pdf" test-data/samples/ 2>/dev/null
    echo "✅ Copied to test-data/samples/"
else
    echo "❌ Sample PDF not found"
fi

# Create initial status files
echo ""
echo "Creating initial status files..."
for i in {1..5}; do
    cat > "parallel-implementation-plans/status/AGENT-$i-STATUS.md" << EOF
# Agent $i Status - Day 0 (Pre-launch)

## Date: $(date +%Y-%m-%d)

## Environment Check
- Waiting to start...

## Completed Today
- Not started yet

## In Progress
- Awaiting launch approval

## Ready for Integration
- None

## Tomorrow's Plan
- Begin Day 1 tasks from AGENT-$i plan

---
*Last updated: $(date +"%H:%M %Z")*
EOF
done

echo "✅ Created initial status files for all agents"

echo ""
echo "================================================="
echo "Environment check complete!"
echo ""
echo "Agents can work with:"
echo "- Python 3.8+ (any available version)"
echo "- Node.js 16+ (any available version)"
echo "- OCR is optional (can be added later)"
echo ""
echo "Ready to launch agents! 🚀"
echo "Human task: Review and say 'start'"