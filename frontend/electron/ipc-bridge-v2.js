/**
 * Enhanced IPC Bridge with request correlation and advanced features
 * Handles communication between Electron main process and Python backend
 */

const { EventEmitter } = require('events');
const PythonProcess = require('./python-process');
const EnhancedMessageQueue = require('./enhanced-message-queue');
const { 
  MessageFactory, 
  MessageType, 
  MessageStatus,
  Priority,
  ErrorCode,
  BaseMessage,
  ResponseMessage
} = require('./protocols/message-protocol');

class IPCBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      pythonPath: options.pythonPath || null,
      scriptPath: options.scriptPath || null,
      maxRetries: options.maxRetries || 3,
      defaultTimeout: options.defaultTimeout || 30000,
      queueSize: options.queueSize || 1000,
      debug: options.debug || process.env.IPC_DEBUG === 'true',
      ...options
    };
    
    this.pythonProcess = null;
    this.messageQueue = null;
    this.isConnected = false;
    this.connectionId = null;
    this.sessionMap = new Map(); // sessionId -> session data
    
    this.setupDebugLogging();
  }

  /**
   * Initialize the IPC bridge
   */
  async initialize() {
    try {
      this.log('info', 'Initializing IPC Bridge...');
      
      // Create message queue
      this.messageQueue = new EnhancedMessageQueue({
        maxSize: this.options.queueSize,
        defaultTimeout: this.options.defaultTimeout,
        maxRetries: this.options.maxRetries
      });
      
      this.setupQueueHandlers();
      
      // Create Python process manager
      this.pythonProcess = new PythonProcess({
        pythonPath: this.options.pythonPath,
        scriptPath: this.options.scriptPath
      });
      
      this.setupProcessHandlers();
      
      // Start Python process
      await this.pythonProcess.start();
      
      // Test connection
      await this.testConnection();
      
      this.isConnected = true;
      this.connectionId = `conn-${Date.now()}`;
      
      this.log('info', 'IPC Bridge initialized successfully');
      this.emit('connected', { connectionId: this.connectionId });
      
      // Start processing queue
      this.startQueueProcessor();
      
      return true;
    } catch (error) {
      this.log('error', 'Failed to initialize IPC Bridge', error);
      throw error;
    }
  }

  /**
   * Setup queue event handlers
   */
  setupQueueHandlers() {
    this.messageQueue.on('health', (health) => {
      if (!health.healthy) {
        this.log('warn', 'Queue health degraded', health);
        this.emit('health', health);
      }
    });
    
    this.messageQueue.on('failed', ({ item, error }) => {
      this.log('error', `Message failed after ${item.retries} retries`, {
        messageId: item.message.id,
        type: item.message.type,
        error: error.message
      });
      this.emit('messageFailed', { message: item.message, error });
    });
    
    this.messageQueue.on('retrying', ({ item, attempt, backoffMs }) => {
      this.log('debug', `Retrying message ${item.message.id}, attempt ${attempt}, backoff ${backoffMs}ms`);
    });
  }

  /**
   * Setup Python process handlers
   */
  setupProcessHandlers() {
    this.pythonProcess.on('message', (data) => {
      this.handleIncomingMessage(data);
    });
    
    this.pythonProcess.on('error', (error) => {
      this.log('error', 'Python process error', error);
      this.emit('error', error);
    });
    
    this.pythonProcess.on('exit', (code) => {
      this.log('warn', `Python process exited with code ${code}`);
      this.isConnected = false;
      this.emit('disconnected', { code });
      
      // Fail all pending messages
      const stats = this.messageQueue.getStats();
      if (stats.queueDepth.pending > 0 || stats.queueDepth.processing > 0) {
        this.messageQueue.clear({ 
          pending: true, 
          processing: true, 
          correlations: true 
        });
      }
    });
  }

  /**
   * Handle incoming message from Python
   */
  handleIncomingMessage(data) {
    try {
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      this.log('debug', 'Received message', {
        type: message.type,
        id: message.id,
        correlationId: message.correlationId
      });
      
      // Check if this is a response to a correlated request
      if (message.correlationId) {
        this.messageQueue.processResponse(message);
        return;
      }
      
      // Handle progress events
      if (message.type.includes('.progress')) {
        this.handleProgressMessage(message);
        return;
      }
      
      // Handle other event types
      this.emit('message', message);
      
    } catch (error) {
      this.log('error', 'Failed to handle incoming message', error);
    }
  }

  /**
   * Handle progress messages
   */
  handleProgressMessage(message) {
    const sessionId = message.payload?.sessionId;
    
    if (sessionId && this.sessionMap.has(sessionId)) {
      const session = this.sessionMap.get(sessionId);
      session.lastProgress = message.payload;
      session.lastUpdated = Date.now();
    }
    
    this.emit('progress', message.payload);
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest(type, payload, options = {}) {
    if (!this.isConnected) {
      throw new Error('IPC Bridge not connected');
    }
    
    const message = MessageFactory.createRequest(type, payload, {
      priority: options.priority || Priority.NORMAL,
      timeout: options.timeout || this.options.defaultTimeout,
      maxRetries: options.maxRetries || this.options.maxRetries
    });
    
    this.log('debug', 'Sending request', {
      id: message.header.id,
      type: message.header.type
    });
    
    try {
      const response = await this.messageQueue.enqueue(message.toJSON(), {
        expectResponse: true,
        timeout: options.timeout || message.header.timeout
      });
      
      if (response.status === MessageStatus.ERROR) {
        const error = new Error(response.error.message);
        error.code = response.error.code;
        error.details = response.error.details;
        throw error;
      }
      
      return response;
    } catch (error) {
      this.log('error', 'Request failed', {
        messageId: message.header.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send a one-way message (no response expected)
   */
  async sendMessage(type, payload, options = {}) {
    if (!this.isConnected) {
      throw new Error('IPC Bridge not connected');
    }
    
    const message = MessageFactory.createRequest(type, payload, {
      priority: options.priority || Priority.NORMAL
    });
    
    this.log('debug', 'Sending message', {
      id: message.header.id,
      type: message.header.type
    });
    
    await this.messageQueue.enqueue(message.toJSON(), {
      expectResponse: false
    });
    
    return message.header.id;
  }

  /**
   * Process PDF extraction
   */
  async extractPDF(filePath, options = {}) {
    const payload = {
      file: filePath,
      mode: options.mode || 'automatic',
      options: options.extractionOptions || {},
      sessionId: options.sessionId || null,
      fields: options.fields || null
    };
    
    const response = await this.sendRequest(
      MessageType.EXTRACTION_PROCESS,
      payload,
      { 
        priority: Priority.HIGH,
        timeout: options.timeout || 60000 // 1 minute default for extraction
      }
    );
    
    // Store session information
    if (response.payload.sessionId) {
      this.sessionMap.set(response.payload.sessionId, {
        type: 'extraction',
        startTime: Date.now(),
        filePath,
        options,
        status: 'active'
      });
    }
    
    return response.payload;
  }

  /**
   * Cancel extraction
   */
  async cancelExtraction(sessionId) {
    const payload = { sessionId };
    
    await this.sendMessage(
      MessageType.EXTRACTION_CANCEL,
      payload,
      { priority: Priority.HIGH }
    );
    
    // Update session status
    if (this.sessionMap.has(sessionId)) {
      const session = this.sessionMap.get(sessionId);
      session.status = 'cancelled';
    }
    
    return true;
  }

  /**
   * Export to Excel
   */
  async exportToExcel(sessionId, outputPath, options = {}) {
    const payload = {
      sessionId,
      outputPath,
      format: options.format || 'xlsx',
      options: options.exportOptions || {}
    };
    
    const response = await this.sendRequest(
      MessageType.EXPORT_EXCEL,
      payload,
      {
        priority: Priority.NORMAL,
        timeout: options.timeout || 30000
      }
    );
    
    return response.payload;
  }

  /**
   * Validate file
   */
  async validateFile(filePath) {
    const payload = { path: filePath };
    
    const response = await this.sendRequest(
      MessageType.FILE_VALIDATE,
      payload,
      { priority: Priority.HIGH }
    );
    
    return response.payload;
  }

  /**
   * Get session information
   */
  getSession(sessionId) {
    return this.sessionMap.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    const sessions = [];
    for (const [id, session] of this.sessionMap) {
      if (session.status === 'active') {
        sessions.push({ id, ...session });
      }
    }
    return sessions;
  }

  /**
   * Test connection with ping/pong
   */
  async testConnection() {
    const response = await this.sendRequest(
      MessageType.PING,
      {},
      { timeout: 5000 }
    );
    
    if (response.type !== MessageType.PONG) {
      throw new Error('Invalid ping response');
    }
    
    return true;
  }

  /**
   * Start queue processor
   */
  startQueueProcessor() {
    this.processorInterval = setInterval(() => {
      this.processQueue();
    }, 10); // Process every 10ms
  }

  /**
   * Process queued messages
   */
  async processQueue() {
    if (!this.isConnected || !this.pythonProcess.isReady()) {
      return;
    }
    
    const item = this.messageQueue.dequeue();
    if (!item) {
      return;
    }
    
    try {
      // Send to Python process
      await this.pythonProcess.send(item.message);
      
      // If no response expected, mark as complete
      if (!item.correlationHandler) {
        this.messageQueue.complete(item.message.id);
      }
    } catch (error) {
      this.messageQueue.fail(item.message.id, error);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      connected: this.isConnected,
      connectionId: this.connectionId,
      pythonProcess: this.pythonProcess ? {
        pid: this.pythonProcess.process?.pid,
        uptime: this.pythonProcess.getUptime()
      } : null,
      queue: this.messageQueue ? this.messageQueue.getStats() : null,
      sessions: {
        total: this.sessionMap.size,
        active: this.getActiveSessions().length
      }
    };
  }

  /**
   * Setup debug logging
   */
  setupDebugLogging() {
    if (!this.options.debug) {
      this.log = () => {}; // No-op
      return;
    }
    
    this.log = (level, message, data = null) => {
      const timestamp = new Date().toISOString();
      const logData = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[IPC ${timestamp}] ${level.toUpperCase()}: ${message}${logData}`);
    };
  }

  /**
   * Shutdown the IPC bridge
   */
  async shutdown(graceful = true) {
    this.log('info', 'Shutting down IPC Bridge...');
    
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
    }
    
    if (graceful && this.isConnected) {
      try {
        await this.sendMessage(MessageType.SHUTDOWN, {}, {
          priority: Priority.CRITICAL
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      } catch (error) {
        this.log('warn', 'Graceful shutdown failed', error);
      }
    }
    
    if (this.messageQueue) {
      this.messageQueue.destroy();
    }
    
    if (this.pythonProcess) {
      await this.pythonProcess.stop();
    }
    
    this.isConnected = false;
    this.sessionMap.clear();
    
    this.log('info', 'IPC Bridge shutdown complete');
    this.emit('shutdown');
  }
}

module.exports = IPCBridge;