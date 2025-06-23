/**
 * Retry handler with exponential backoff and circuit breaker pattern
 */

const EventEmitter = require('events');

class RetryHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000, // 1 second
      maxDelay: options.maxDelay || 30000, // 30 seconds
      backoffMultiplier: options.backoffMultiplier || 2,
      jitterFactor: options.jitterFactor || 0.1, // 10% jitter
      retryableErrors: options.retryableErrors || [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
        'TIMEOUT',
        'CONNECTION_LOST'
      ],
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerResetTime: options.circuitBreakerResetTime || 60000 // 1 minute
    };
    
    // Circuit breaker state
    this.circuitBreaker = {
      state: 'closed', // closed, open, half-open
      failures: 0,
      lastFailureTime: null,
      nextRetryTime: null
    };
    
    // Retry statistics
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      retriedAttempts: 0,
      circuitBreakerTrips: 0
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute(fn, context = null, options = {}) {
    const maxRetries = options.maxRetries || this.options.maxRetries;
    const retryableErrors = options.retryableErrors || this.options.retryableErrors;
    
    // Check circuit breaker
    if (!this.isCircuitClosed()) {
      const error = new Error('Circuit breaker is open');
      error.code = 'CIRCUIT_BREAKER_OPEN';
      error.nextRetryTime = this.circuitBreaker.nextRetryTime;
      throw error;
    }
    
    let lastError;
    let attempt = 0;
    
    while (attempt <= maxRetries) {
      try {
        this.stats.totalAttempts++;
        
        // Execute the function
        const result = await fn.call(context);
        
        // Success - reset circuit breaker
        this.onSuccess();
        this.stats.successfulAttempts++;
        
        if (attempt > 0) {
          this.emit('retrySuccess', { attempt, totalAttempts: attempt + 1 });
        }
        
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, retryableErrors)) {
          this.stats.failedAttempts++;
          this.onFailure(error);
          throw error;
        }
        
        // Check if we've exhausted retries
        if (attempt >= maxRetries) {
          this.stats.failedAttempts++;
          this.onFailure(error);
          error.retriesExhausted = true;
          error.attempts = attempt + 1;
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, options);
        
        this.stats.retriedAttempts++;
        this.emit('retry', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: error.message,
          errorCode: error.code
        });
        
        // Wait before retrying
        await this.sleep(delay);
        
        attempt++;
      }
    }
    
    // Should never reach here, but just in case
    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error, retryableErrors) {
    // Check error code
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check error message patterns
    const errorMessage = error.message?.toLowerCase() || '';
    const retryablePatterns = [
      'timeout',
      'timed out',
      'connection refused',
      'connection reset',
      'socket hang up',
      'econnreset',
      'network'
    ];
    
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt, options = {}) {
    const initialDelay = options.initialDelay || this.options.initialDelay;
    const maxDelay = options.maxDelay || this.options.maxDelay;
    const multiplier = options.backoffMultiplier || this.options.backoffMultiplier;
    const jitterFactor = options.jitterFactor || this.options.jitterFactor;
    
    // Exponential backoff
    let delay = initialDelay * Math.pow(multiplier, attempt);
    
    // Cap at max delay
    delay = Math.min(delay, maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    delay = Math.round(delay + jitter);
    
    return Math.max(delay, 0);
  }

  /**
   * Check if circuit breaker is closed (allowing requests)
   */
  isCircuitClosed() {
    const now = Date.now();
    
    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;
        
      case 'open':
        // Check if enough time has passed to move to half-open
        if (now >= this.circuitBreaker.nextRetryTime) {
          this.circuitBreaker.state = 'half-open';
          this.emit('circuitBreakerHalfOpen');
          return true; // Allow one request to test
        }
        return false;
        
      case 'half-open':
        return true; // Allow request to test if service is back
        
      default:
        return true;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    if (this.circuitBreaker.state === 'half-open') {
      // Service is back, close the circuit
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      this.emit('circuitBreakerClosed');
    } else if (this.circuitBreaker.state === 'closed') {
      // Reset failure count on success
      this.circuitBreaker.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.state === 'half-open') {
      // Still failing, reopen the circuit
      this.openCircuit();
    } else if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
      // Too many failures, open the circuit
      this.openCircuit();
    }
  }

  /**
   * Open the circuit breaker
   */
  openCircuit() {
    this.circuitBreaker.state = 'open';
    this.circuitBreaker.nextRetryTime = Date.now() + this.options.circuitBreakerResetTime;
    this.stats.circuitBreakerTrips++;
    
    this.emit('circuitBreakerOpen', {
      failures: this.circuitBreaker.failures,
      nextRetryTime: new Date(this.circuitBreaker.nextRetryTime)
    });
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker() {
    this.circuitBreaker = {
      state: 'closed',
      failures: 0,
      lastFailureTime: null,
      nextRetryTime: null
    };
    this.emit('circuitBreakerReset');
  }

  /**
   * Get current state
   */
  getState() {
    return {
      circuitBreaker: {
        ...this.circuitBreaker,
        isOpen: this.circuitBreaker.state === 'open',
        timeUntilNextRetry: this.circuitBreaker.nextRetryTime 
          ? Math.max(0, this.circuitBreaker.nextRetryTime - Date.now())
          : null
      },
      stats: { ...this.stats },
      config: { ...this.options }
    };
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for a function
   */
  wrap(fn, options = {}) {
    return async (...args) => {
      return this.execute(() => fn(...args), null, options);
    };
  }

  /**
   * Decorator for class methods (when decorators are supported)
   */
  static retry(options = {}) {
    return function(target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;
      const handler = new RetryHandler(options);
      
      descriptor.value = async function(...args) {
        return handler.execute(() => originalMethod.apply(this, args), this, options);
      };
      
      return descriptor;
    };
  }
}

/**
 * Timeout handler for managing request timeouts
 */
class TimeoutHandler {
  constructor(options = {}) {
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
    this.timeouts = new Map(); // requestId -> timeout handle
  }

  /**
   * Execute function with timeout
   */
  async execute(fn, timeout = null, requestId = null) {
    const timeoutMs = timeout || this.defaultTimeout;
    const id = requestId || `timeout-${Date.now()}`;
    
    return new Promise(async (resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.timeouts.delete(id);
        const error = new Error(`Operation timed out after ${timeoutMs}ms`);
        error.code = 'TIMEOUT';
        error.timeout = timeoutMs;
        reject(error);
      }, timeoutMs);
      
      this.timeouts.set(id, timeoutHandle);
      
      try {
        // Execute function
        const result = await fn();
        
        // Clear timeout
        this.clear(id);
        resolve(result);
        
      } catch (error) {
        // Clear timeout
        this.clear(id);
        reject(error);
      }
    });
  }

  /**
   * Clear a specific timeout
   */
  clear(requestId) {
    const timeoutHandle = this.timeouts.get(requestId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeouts.delete(requestId);
    }
  }

  /**
   * Clear all timeouts
   */
  clearAll() {
    for (const [id, handle] of this.timeouts) {
      clearTimeout(handle);
    }
    this.timeouts.clear();
  }

  /**
   * Get active timeout count
   */
  getActiveCount() {
    return this.timeouts.size;
  }

  /**
   * Create a timeout wrapper for a function
   */
  wrap(fn, timeout = null) {
    return async (...args) => {
      return this.execute(() => fn(...args), timeout);
    };
  }
}

module.exports = {
  RetryHandler,
  TimeoutHandler
};