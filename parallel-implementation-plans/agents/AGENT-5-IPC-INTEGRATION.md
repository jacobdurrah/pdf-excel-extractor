# Agent 5: IPC Bridge & Integration

## Mission
Build the robust communication bridge between Electron frontend and Python backend, ensuring seamless data flow and error handling.

## Key Responsibilities
1. Electron ↔ Python IPC implementation
2. Message queuing and routing
3. Error handling and recovery
4. Progress streaming
5. Performance optimization

## Day-by-Day Plan

### Day 1: IPC Foundation
- [ ] Check both Python and Node.js versions
- [ ] Create `frontend/electron/ipc-bridge.js`
- [ ] Set up Python subprocess management with version detection:
  - Try `python3` first, fallback to `python`
  - Adapt to available Python version (3.8+)
- [ ] Implement basic request/response protocol
- [ ] Create message serialization (JSON)
- [ ] Test basic communication
- [ ] Create compatibility layer for version differences
- [ ] Update STATUS.md with environment details

### Day 2: Message Protocol
- [ ] Design comprehensive message schema
- [ ] Implement request queuing system
- [ ] Create response correlation (request IDs)
- [ ] Add timeout handling
- [ ] Build retry mechanisms
- [ ] Update STATUS.md

### Day 3: Progress & Streaming
- [ ] Implement progress event streaming
- [ ] Create chunked file transfer for large PDFs
- [ ] Build extraction progress updates
- [ ] Add cancel operation support
- [ ] Implement backpressure handling
- [ ] Update STATUS.md

### Day 4: Error Handling
- [ ] Create comprehensive error types
- [ ] Implement error recovery strategies
- [ ] Add circuit breaker pattern
- [ ] Build error reporting to UI
- [ ] Create fallback mechanisms
- [ ] Update STATUS.md

### Day 5: Performance & Integration
- [ ] Optimize message passing performance
- [ ] Implement connection pooling
- [ ] Add performance monitoring
- [ ] Create integration tests
- [ ] Document all protocols
- [ ] Final STATUS.md update

## Technical Specifications

### IPC Architecture
```
frontend/electron/
├── ipc-bridge.js       # Main IPC handler
├── python-process.js   # Python subprocess manager
├── message-queue.js    # Request queuing
└── protocols/
    ├── extraction.js   # Extraction protocol
    ├── export.js      # Export protocol
    └── file.js        # File transfer protocol

backend/app/
├── ipc_server.py      # IPC server endpoint
├── message_handler.py # Message routing
└── protocols.py       # Protocol definitions
```

### Message Protocol
```javascript
// Request
{
  id: "req-123",
  type: "extraction.process",
  timestamp: 1634567890,
  payload: {
    fileId: "file-456",
    mode: "step-by-step",
    options: {}
  }
}

// Response
{
  id: "req-123",
  type: "extraction.process.response",
  timestamp: 1634567891,
  status: "success",
  payload: {
    sessionId: "session-789",
    fields: []
  }
}

// Progress Event
{
  type: "extraction.progress",
  sessionId: "session-789",
  progress: 45,
  currentField: "check_number",
  message: "Extracting check number..."
}
```

### Python Subprocess Management
```javascript
class PythonBridge {
  constructor() {
    this.process = null;
    this.messageQueue = new MessageQueue();
    this.pendingRequests = new Map();
  }

  async start() {
    const pythonPath = process.platform === 'win32' 
      ? 'python' : 'python3';
    
    this.process = spawn(pythonPath, [
      path.join(__dirname, '../../backend/app/ipc_server.py')
    ], {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    this.setupListeners();
  }

  async sendRequest(type, payload) {
    const request = {
      id: generateId(),
      type,
      timestamp: Date.now(),
      payload
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(request.id, { resolve, reject });
      this.messageQueue.enqueue(request);
      
      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30s timeout
    });
  }
}
```

### Error Types
```javascript
const IPC_ERRORS = {
  TIMEOUT: 'IPC_TIMEOUT',
  PYTHON_CRASH: 'PYTHON_CRASH',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  QUEUE_FULL: 'QUEUE_FULL',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MEMORY_LIMIT: 'MEMORY_LIMIT'
};
```

### Performance Optimizations
```javascript
// Message compression for large payloads
const compressMessage = (message) => {
  if (JSON.stringify(message).length > 10240) { // 10KB
    return {
      ...message,
      compressed: true,
      payload: zlib.gzipSync(JSON.stringify(message.payload))
    };
  }
  return message;
};

// Connection pooling for multiple operations
class ConnectionPool {
  constructor(size = 3) {
    this.connections = [];
    this.available = [];
    this.initializePool(size);
  }
}
```

## Integration Points

### Frontend Integration
```javascript
// In renderer process
const { ipcRenderer } = require('electron');

async function extractPDF(file) {
  try {
    const result = await ipcRenderer.invoke('extract-pdf', {
      file: file.path,
      mode: 'step-by-step'
    });
    return result;
  } catch (error) {
    handleIPCError(error);
  }
}
```

### Backend Integration
```python
# In ipc_server.py
async def handle_message(message):
    msg_type = message.get('type')
    
    if msg_type == 'extraction.process':
        return await extraction_handler(message['payload'])
    elif msg_type == 'export.excel':
        return await export_handler(message['payload'])
    else:
        raise ValueError(f"Unknown message type: {msg_type}")
```

## Monitoring & Debugging

### Performance Metrics
- Message latency (target: <50ms)
- Queue depth
- Memory usage
- Error rate
- Retry count

### Debug Mode
```javascript
if (process.env.IPC_DEBUG) {
  ipcBridge.on('message', (msg) => {
    console.log('[IPC]', new Date().toISOString(), msg);
  });
}
```

## Success Criteria
- [ ] Bi-directional communication works
- [ ] Large files transfer successfully
- [ ] Progress updates stream smoothly
- [ ] Errors handled gracefully
- [ ] Performance targets met
- [ ] No message loss under load
- [ ] Cancellation works properly
- [ ] Ready for integration by Day 5

## Daily Status Updates
Create `/parallel-implementation-plans/status/AGENT-5-STATUS.md` and update daily with:
- Protocols implemented
- Performance benchmarks
- Integration test results
- Known issues/limitations