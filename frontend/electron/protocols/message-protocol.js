/**
 * Message Protocol Definitions for IPC Communication
 * 
 * This module defines the comprehensive message schema for all IPC communications
 * between the Electron frontend and Python backend.
 */

const crypto = require('crypto');

/**
 * Message types enumeration
 */
const MessageType = {
  // System messages
  PING: 'ping',
  PONG: 'pong',
  SHUTDOWN: 'shutdown',
  
  // Extraction messages
  EXTRACTION_PROCESS: 'extraction.process',
  EXTRACTION_CANCEL: 'extraction.cancel',
  EXTRACTION_PROGRESS: 'extraction.progress',
  EXTRACTION_COMPLETE: 'extraction.complete',
  EXTRACTION_ERROR: 'extraction.error',
  
  // Export messages
  EXPORT_EXCEL: 'export.excel',
  EXPORT_PROGRESS: 'export.progress',
  EXPORT_COMPLETE: 'export.complete',
  EXPORT_ERROR: 'export.error',
  
  // File messages
  FILE_READ: 'file.read',
  FILE_VALIDATE: 'file.validate',
  FILE_CHUNK: 'file.chunk',
  
  // Session messages
  SESSION_CREATE: 'session.create',
  SESSION_UPDATE: 'session.update',
  SESSION_DELETE: 'session.delete',
  SESSION_LIST: 'session.list'
};

/**
 * Message status values
 */
const MessageStatus = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  CANCELLED: 'cancelled'
};

/**
 * Message priority levels
 */
const Priority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
};

/**
 * Error codes
 */
const ErrorCode = {
  // System errors
  UNKNOWN_ERROR: 'ERR_UNKNOWN',
  INVALID_MESSAGE: 'ERR_INVALID_MESSAGE',
  TIMEOUT: 'ERR_TIMEOUT',
  RATE_LIMIT: 'ERR_RATE_LIMIT',
  
  // Connection errors
  CONNECTION_LOST: 'ERR_CONNECTION_LOST',
  CONNECTION_REFUSED: 'ERR_CONNECTION_REFUSED',
  
  // File errors
  FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'ERR_FILE_ACCESS_DENIED',
  FILE_TOO_LARGE: 'ERR_FILE_TOO_LARGE',
  INVALID_FILE_FORMAT: 'ERR_INVALID_FILE_FORMAT',
  
  // Processing errors
  EXTRACTION_FAILED: 'ERR_EXTRACTION_FAILED',
  EXPORT_FAILED: 'ERR_EXPORT_FAILED',
  VALIDATION_FAILED: 'ERR_VALIDATION_FAILED',
  
  // Resource errors
  MEMORY_LIMIT: 'ERR_MEMORY_LIMIT',
  QUEUE_FULL: 'ERR_QUEUE_FULL',
  SESSION_NOT_FOUND: 'ERR_SESSION_NOT_FOUND'
};

/**
 * Generate unique message ID
 */
function generateMessageId() {
  return `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Message header class
 */
class MessageHeader {
  constructor(options = {}) {
    this.id = options.id || generateMessageId();
    this.type = options.type || '';
    this.timestamp = options.timestamp || Date.now();
    this.version = options.version || '1.0';
    this.correlationId = options.correlationId || null;
    this.priority = options.priority || Priority.NORMAL;
    this.timeout = options.timeout || null;
    this.retryCount = options.retryCount || 0;
    this.maxRetries = options.maxRetries || 3;
  }
}

/**
 * Base message class
 */
class BaseMessage {
  constructor(header, payload = {}) {
    this.header = header instanceof MessageHeader ? header : new MessageHeader(header);
    this.payload = payload;
  }

  toJSON() {
    return {
      id: this.header.id,
      type: this.header.type,
      timestamp: this.header.timestamp,
      version: this.header.version,
      correlationId: this.header.correlationId,
      priority: this.header.priority,
      timeout: this.header.timeout,
      retryCount: this.header.retryCount,
      maxRetries: this.header.maxRetries,
      payload: this.payload
    };
  }

  static fromJSON(data) {
    const header = new MessageHeader({
      id: data.id,
      type: data.type,
      timestamp: data.timestamp,
      version: data.version,
      correlationId: data.correlationId,
      priority: data.priority,
      timeout: data.timeout,
      retryCount: data.retryCount,
      maxRetries: data.maxRetries
    });
    return new BaseMessage(header, data.payload);
  }
}

/**
 * Response message class
 */
class ResponseMessage extends BaseMessage {
  constructor(header, status, payload = {}, error = null) {
    super(header, payload);
    this.status = status;
    this.error = error;
    this.processingTime = null;
  }

  toJSON() {
    const json = super.toJSON();
    json.status = this.status;
    if (this.error) {
      json.error = this.error;
    }
    if (this.processingTime !== null) {
      json.processingTime = this.processingTime;
    }
    return json;
  }

  static fromJSON(data) {
    const base = BaseMessage.fromJSON(data);
    const response = new ResponseMessage(
      base.header,
      data.status,
      base.payload,
      data.error
    );
    response.processingTime = data.processingTime;
    return response;
  }
}

/**
 * Message factory for creating standardized messages
 */
class MessageFactory {
  /**
   * Create a request message
   */
  static createRequest(type, payload, options = {}) {
    const header = new MessageHeader({
      type,
      priority: options.priority || Priority.NORMAL,
      timeout: options.timeout,
      maxRetries: options.maxRetries
    });
    return new BaseMessage(header, payload);
  }

  /**
   * Create a response message
   */
  static createResponse(request, status, payload, error = null) {
    const header = new MessageHeader({
      type: `${request.header.type}.response`,
      correlationId: request.header.id
    });
    
    const response = new ResponseMessage(header, status, payload, error);
    response.processingTime = Date.now() - request.header.timestamp;
    return response;
  }

  /**
   * Create a progress message
   */
  static createProgress(type, sessionId, progressData) {
    const header = new MessageHeader({
      type,
      priority: Priority.LOW
    });
    const payload = { sessionId, ...progressData };
    return new BaseMessage(header, payload);
  }

  /**
   * Create an error response
   */
  static createError(request, errorCode, errorMessage, details = null) {
    const error = {
      code: errorCode,
      message: errorMessage,
      details,
      timestamp: Date.now()
    };
    return this.createResponse(request, MessageStatus.ERROR, {}, error);
  }
}

/**
 * Extraction request builder
 */
class ExtractionRequest {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.mode = options.mode || 'automatic';
    this.options = options.options || {};
    this.sessionId = options.sessionId || null;
    this.fields = options.fields || null;
  }

  toPayload() {
    return {
      file: this.filePath,
      mode: this.mode,
      options: this.options,
      sessionId: this.sessionId,
      fields: this.fields
    };
  }
}

/**
 * Export request builder
 */
class ExportRequest {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.outputPath = options.outputPath || null;
    this.format = options.format || 'xlsx';
    this.options = options.options || {};
  }

  toPayload() {
    return {
      sessionId: this.sessionId,
      outputPath: this.outputPath,
      format: this.format,
      options: this.options
    };
  }
}

/**
 * File chunk for large file transfers
 */
class FileChunk {
  constructor(sessionId, chunkIndex, totalChunks, data) {
    this.sessionId = sessionId;
    this.chunkIndex = chunkIndex;
    this.totalChunks = totalChunks;
    this.data = data;
    this.checksum = crypto.createHash('md5').update(data).digest('hex');
  }

  toPayload() {
    return {
      sessionId: this.sessionId,
      chunkIndex: this.chunkIndex,
      totalChunks: this.totalChunks,
      data: this.data.toString('hex'),
      checksum: this.checksum
    };
  }

  static fromPayload(payload) {
    const data = Buffer.from(payload.data, 'hex');
    const chunk = new FileChunk(
      payload.sessionId,
      payload.chunkIndex,
      payload.totalChunks,
      data
    );
    
    // Verify checksum
    if (chunk.checksum !== payload.checksum) {
      throw new Error('Checksum mismatch');
    }
    
    return chunk;
  }
}

/**
 * Message validator
 */
class MessageValidator {
  static validate(message) {
    const errors = [];

    // Check required fields
    if (!message.id) errors.push('Missing message ID');
    if (!message.type) errors.push('Missing message type');
    if (!message.timestamp) errors.push('Missing timestamp');
    
    // Validate message type
    const validTypes = Object.values(MessageType);
    if (!validTypes.includes(message.type) && !message.type.endsWith('.response')) {
      errors.push(`Invalid message type: ${message.type}`);
    }
    
    // Validate priority
    if (message.priority !== undefined) {
      const validPriorities = Object.values(Priority);
      if (!validPriorities.includes(message.priority)) {
        errors.push(`Invalid priority: ${message.priority}`);
      }
    }
    
    // Validate status for response messages
    if (message.status !== undefined) {
      const validStatuses = Object.values(MessageStatus);
      if (!validStatuses.includes(message.status)) {
        errors.push(`Invalid status: ${message.status}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = {
  MessageType,
  MessageStatus,
  Priority,
  ErrorCode,
  MessageHeader,
  BaseMessage,
  ResponseMessage,
  MessageFactory,
  ExtractionRequest,
  ExportRequest,
  FileChunk,
  MessageValidator,
  generateMessageId
};