/**
 * Enhanced message queue with request correlation and advanced features
 */

const EventEmitter = require('events');
const { MessageValidator } = require('./protocols/message-protocol');

class EnhancedMessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.maxSize = options.maxSize || 1000;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    
    // Queues
    this.pendingQueue = [];
    this.processingMap = new Map(); // messageId -> message
    this.correlationMap = new Map(); // correlationId -> { resolve, reject, timer }
    
    // Statistics
    this.stats = {
      enqueued: 0,
      processed: 0,
      failed: 0,
      timedOut: 0,
      retried: 0,
      rejected: 0
    };
    
    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Enqueue a message with correlation support
   */
  async enqueue(message, options = {}) {
    // Validate message
    const validation = MessageValidator.validate(message);
    if (!validation.valid) {
      const error = new Error(`Invalid message: ${validation.errors.join(', ')}`);
      this.stats.rejected++;
      throw error;
    }

    // Check queue capacity
    if (this.pendingQueue.length >= this.maxSize) {
      const error = new Error('Queue is full');
      error.code = 'QUEUE_FULL';
      this.stats.rejected++;
      throw error;
    }

    // Create queue item
    const queueItem = {
      message,
      priority: message.priority || 2,
      timestamp: Date.now(),
      retries: 0,
      timeout: options.timeout || message.timeout || this.defaultTimeout,
      correlationHandler: options.correlationHandler || null
    };

    // Set up correlation if this is a request expecting a response
    if (options.expectResponse) {
      return this.enqueueWithCorrelation(queueItem);
    }

    // Regular enqueue
    this.insertByPriority(queueItem);
    this.stats.enqueued++;
    this.emit('enqueued', queueItem);
    
    return queueItem.message.id;
  }

  /**
   * Enqueue with response correlation
   */
  enqueueWithCorrelation(queueItem) {
    return new Promise((resolve, reject) => {
      const messageId = queueItem.message.id;
      
      // Set up timeout
      const timer = setTimeout(() => {
        if (this.correlationMap.has(messageId)) {
          this.correlationMap.delete(messageId);
          this.stats.timedOut++;
          const error = new Error(`Request timeout: ${messageId}`);
          error.code = 'TIMEOUT';
          reject(error);
        }
      }, queueItem.timeout);

      // Store correlation info
      this.correlationMap.set(messageId, {
        resolve,
        reject,
        timer,
        request: queueItem.message,
        startTime: Date.now()
      });

      // Enqueue the message
      this.insertByPriority(queueItem);
      this.stats.enqueued++;
      this.emit('enqueued', queueItem);
    });
  }

  /**
   * Process a response message
   */
  processResponse(responseMessage) {
    const correlationId = responseMessage.correlationId;
    
    if (!correlationId || !this.correlationMap.has(correlationId)) {
      // No correlation found, emit as regular event
      this.emit('unhandledResponse', responseMessage);
      return;
    }

    const correlation = this.correlationMap.get(correlationId);
    this.correlationMap.delete(correlationId);
    
    // Clear timeout
    clearTimeout(correlation.timer);
    
    // Calculate processing time
    const processingTime = Date.now() - correlation.startTime;
    
    // Resolve or reject based on status
    if (responseMessage.status === 'error' && responseMessage.error) {
      const error = new Error(responseMessage.error.message);
      error.code = responseMessage.error.code;
      error.details = responseMessage.error.details;
      correlation.reject(error);
    } else {
      correlation.resolve({
        ...responseMessage,
        processingTime
      });
    }
    
    this.emit('responseProcessed', {
      request: correlation.request,
      response: responseMessage,
      processingTime
    });
  }

  /**
   * Insert item by priority
   */
  insertByPriority(queueItem) {
    let inserted = false;
    
    for (let i = 0; i < this.pendingQueue.length; i++) {
      if (queueItem.priority > this.pendingQueue[i].priority) {
        this.pendingQueue.splice(i, 0, queueItem);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.pendingQueue.push(queueItem);
    }
  }

  /**
   * Get next item from queue
   */
  dequeue() {
    if (this.pendingQueue.length === 0) {
      return null;
    }

    if (this.processingMap.size >= this.maxConcurrent) {
      return null; // At capacity
    }

    const item = this.pendingQueue.shift();
    this.processingMap.set(item.message.id, item);
    this.emit('dequeued', item);
    
    return item;
  }

  /**
   * Mark message as completed
   */
  complete(messageId, response = null) {
    if (!this.processingMap.has(messageId)) {
      return false;
    }

    const item = this.processingMap.get(messageId);
    this.processingMap.delete(messageId);
    this.stats.processed++;
    
    this.emit('completed', {
      item,
      response,
      processingTime: Date.now() - item.timestamp
    });
    
    return true;
  }

  /**
   * Mark message as failed
   */
  fail(messageId, error) {
    if (!this.processingMap.has(messageId)) {
      return false;
    }

    const item = this.processingMap.get(messageId);
    this.processingMap.delete(messageId);
    
    // Check if we should retry
    if (item.retries < this.maxRetries) {
      item.retries++;
      item.message.retryCount = item.retries;
      
      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, item.retries), 30000);
      
      setTimeout(() => {
        this.insertByPriority(item);
        this.stats.retried++;
        this.emit('retrying', { item, attempt: item.retries, backoffMs });
      }, backoffMs);
      
      return true;
    }
    
    // Max retries exceeded
    this.stats.failed++;
    this.emit('failed', { item, error });
    
    // Handle correlation failure
    if (this.correlationMap.has(messageId)) {
      const correlation = this.correlationMap.get(messageId);
      this.correlationMap.delete(messageId);
      clearTimeout(correlation.timer);
      correlation.reject(error);
    }
    
    return false;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const queueDepth = {
      pending: this.pendingQueue.length,
      processing: this.processingMap.size,
      waiting: this.correlationMap.size
    };

    const priorityBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of this.pendingQueue) {
      priorityBreakdown[item.priority] = (priorityBreakdown[item.priority] || 0) + 1;
    }

    return {
      ...this.stats,
      queueDepth,
      priorityBreakdown,
      utilization: (queueDepth.pending / this.maxSize) * 100,
      concurrency: (queueDepth.processing / this.maxConcurrent) * 100,
      oldestPending: this.pendingQueue.length > 0 
        ? Date.now() - this.pendingQueue[0].timestamp 
        : 0
    };
  }

  /**
   * Clear specific types of items
   */
  clear(options = {}) {
    if (options.pending) {
      this.pendingQueue = [];
    }
    
    if (options.processing) {
      // Cancel all processing items
      for (const [messageId, item] of this.processingMap) {
        this.fail(messageId, new Error('Queue cleared'));
      }
    }
    
    if (options.correlations) {
      // Cancel all waiting correlations
      for (const [messageId, correlation] of this.correlationMap) {
        clearTimeout(correlation.timer);
        correlation.reject(new Error('Queue cleared'));
      }
      this.correlationMap.clear();
    }
    
    this.emit('cleared', options);
  }

  /**
   * Start queue monitoring
   */
  startMonitoring() {
    // Monitor for stale items
    this.monitorInterval = setInterval(() => {
      const now = Date.now();
      
      // Check for timed out processing items
      for (const [messageId, item] of this.processingMap) {
        if (now - item.timestamp > item.timeout) {
          this.fail(messageId, new Error('Processing timeout'));
        }
      }
      
      // Emit queue health metrics
      this.emit('health', {
        timestamp: now,
        stats: this.getStats(),
        healthy: this.isHealthy()
      });
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop queue monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Check if queue is healthy
   */
  isHealthy() {
    const stats = this.getStats();
    return (
      stats.utilization < 90 &&
      stats.concurrency < 90 &&
      stats.oldestPending < 60000 && // 1 minute
      this.stats.failed < this.stats.processed * 0.1 // Less than 10% failure rate
    );
  }

  /**
   * Get items by status
   */
  getItems(status = 'all') {
    switch (status) {
      case 'pending':
        return [...this.pendingQueue];
      case 'processing':
        return Array.from(this.processingMap.values());
      case 'waiting':
        return Array.from(this.correlationMap.entries()).map(([id, info]) => ({
          messageId: id,
          request: info.request,
          waitTime: Date.now() - info.startTime
        }));
      case 'all':
      default:
        return {
          pending: this.getItems('pending'),
          processing: this.getItems('processing'),
          waiting: this.getItems('waiting')
        };
    }
  }

  /**
   * Cancel a specific message
   */
  cancel(messageId) {
    // Check pending queue
    const pendingIndex = this.pendingQueue.findIndex(item => item.message.id === messageId);
    if (pendingIndex !== -1) {
      const [item] = this.pendingQueue.splice(pendingIndex, 1);
      this.emit('cancelled', { item, stage: 'pending' });
      return true;
    }
    
    // Check processing
    if (this.processingMap.has(messageId)) {
      const item = this.processingMap.get(messageId);
      this.processingMap.delete(messageId);
      this.emit('cancelled', { item, stage: 'processing' });
      return true;
    }
    
    // Check correlations
    if (this.correlationMap.has(messageId)) {
      const correlation = this.correlationMap.get(messageId);
      this.correlationMap.delete(messageId);
      clearTimeout(correlation.timer);
      correlation.reject(new Error('Cancelled by user'));
      this.emit('cancelled', { messageId, stage: 'correlation' });
      return true;
    }
    
    return false;
  }

  /**
   * Destroy the queue
   */
  destroy() {
    this.stopMonitoring();
    this.clear({ pending: true, processing: true, correlations: true });
    this.removeAllListeners();
  }
}

module.exports = EnhancedMessageQueue;