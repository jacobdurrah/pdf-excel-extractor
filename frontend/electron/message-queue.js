/**
 * Message queue for managing IPC requests
 * Provides queuing, prioritization, and backpressure handling
 */
class MessageQueue {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxConcurrent = options.maxConcurrent || 10;
    this.queue = [];
    this.processing = new Set();
    this.priorities = {
      HIGH: 3,
      NORMAL: 2,
      LOW: 1
    };
  }

  /**
   * Add message to queue
   * @param {Object} message - Message to queue
   * @param {string} priority - Priority level (HIGH, NORMAL, LOW)
   * @returns {boolean} - True if queued successfully
   */
  enqueue(message, priority = 'NORMAL') {
    if (this.queue.length >= this.maxSize) {
      throw new Error('Queue is full');
    }

    const queueItem = {
      message,
      priority: this.priorities[priority] || this.priorities.NORMAL,
      timestamp: Date.now(),
      retries: 0
    };

    // Insert based on priority
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (queueItem.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, queueItem);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(queueItem);
    }

    return true;
  }

  /**
   * Get next message from queue
   * @returns {Object|null} - Next message or null if empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    return this.queue.shift();
  }

  /**
   * Peek at next message without removing
   * @returns {Object|null} - Next message or null if empty
   */
  peek() {
    return this.queue[0] || null;
  }

  /**
   * Get queue size
   * @returns {number} - Current queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} - True if empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Check if queue is full
   * @returns {boolean} - True if full
   */
  isFull() {
    return this.queue.length >= this.maxSize;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.processing.clear();
  }

  /**
   * Get queue statistics
   * @returns {Object} - Queue statistics
   */
  getStats() {
    const priorities = { HIGH: 0, NORMAL: 0, LOW: 0 };
    
    for (const item of this.queue) {
      const priority = Object.keys(this.priorities).find(
        key => this.priorities[key] === item.priority
      );
      if (priority) {
        priorities[priority]++;
      }
    }

    return {
      size: this.queue.length,
      processing: this.processing.size,
      maxSize: this.maxSize,
      utilization: (this.queue.length / this.maxSize) * 100,
      priorities,
      oldest: this.queue.length > 0 ? Date.now() - this.queue[0].timestamp : 0
    };
  }

  /**
   * Mark message as being processed
   * @param {string} messageId - Message ID
   */
  markProcessing(messageId) {
    this.processing.add(messageId);
  }

  /**
   * Mark message as completed
   * @param {string} messageId - Message ID
   */
  markCompleted(messageId) {
    this.processing.delete(messageId);
  }

  /**
   * Check if can accept more concurrent requests
   * @returns {boolean} - True if can process more
   */
  canProcess() {
    return this.processing.size < this.maxConcurrent;
  }

  /**
   * Re-queue a failed message with incremented retry count
   * @param {Object} item - Queue item to retry
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {boolean} - True if re-queued, false if max retries exceeded
   */
  retry(item, maxRetries = 3) {
    if (item.retries >= maxRetries) {
      return false;
    }

    item.retries++;
    item.timestamp = Date.now();
    
    // Reduce priority for retried items
    if (item.priority > this.priorities.LOW) {
      item.priority--;
    }

    return this.enqueue(item.message, 
      Object.keys(this.priorities).find(k => this.priorities[k] === item.priority)
    );
  }

  /**
   * Get messages that have been waiting too long
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Array} - Timed out messages
   */
  getTimedOut(timeout = 30000) {
    const now = Date.now();
    const timedOut = [];

    for (const item of this.queue) {
      if (now - item.timestamp > timeout) {
        timedOut.push(item);
      } else {
        // Queue is sorted by priority, then time, so we can stop here
        break;
      }
    }

    return timedOut;
  }
}

module.exports = MessageQueue;