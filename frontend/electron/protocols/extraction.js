/**
 * Extraction Protocol Handler
 * Manages PDF extraction operations through IPC
 */

class ExtractionProtocol {
  constructor(ipcBridge) {
    this.ipcBridge = ipcBridge;
    this.activeSessions = new Map();
  }

  /**
   * Start PDF extraction process
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result
   */
  async startExtraction(options) {
    const { filePath, mode = 'automatic', config = {} } = options;

    // Validate input
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Send extraction request
    const result = await this.ipcBridge.sendRequest('extraction.process', {
      file: filePath,
      mode,
      config
    });

    // Store session info
    if (result.sessionId) {
      this.activeSessions.set(result.sessionId, {
        startTime: Date.now(),
        filePath,
        mode,
        status: 'active'
      });
    }

    return result;
  }

  /**
   * Get extraction session status
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session status
   */
  async getSessionStatus(sessionId) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    const result = await this.ipcBridge.sendRequest('extraction.status', {
      sessionId
    });

    return result;
  }

  /**
   * Update extracted field
   * @param {string} sessionId - Session ID
   * @param {string} fieldName - Field name
   * @param {*} value - New value
   * @returns {Promise<Object>} Update result
   */
  async updateField(sessionId, fieldName, value) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    const result = await this.ipcBridge.sendRequest('extraction.update', {
      sessionId,
      field: fieldName,
      value
    });

    return result;
  }

  /**
   * Add custom field
   * @param {string} sessionId - Session ID
   * @param {Object} field - Field definition
   * @returns {Promise<Object>} Add result
   */
  async addCustomField(sessionId, field) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    const result = await this.ipcBridge.sendRequest('extraction.add_field', {
      sessionId,
      field
    });

    return result;
  }

  /**
   * Cancel extraction session
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async cancelExtraction(sessionId) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    await this.ipcBridge.sendRequest('extraction.cancel', {
      sessionId
    });

    // Update local session status
    const session = this.activeSessions.get(sessionId);
    session.status = 'cancelled';
    session.endTime = Date.now();
  }

  /**
   * Complete extraction session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Final extraction data
   */
  async completeExtraction(sessionId) {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    const result = await this.ipcBridge.sendRequest('extraction.complete', {
      sessionId
    });

    // Update local session status
    const session = this.activeSessions.get(sessionId);
    session.status = 'completed';
    session.endTime = Date.now();

    return result;
  }

  /**
   * Get all active sessions
   * @returns {Array} Active sessions
   */
  getActiveSessions() {
    const sessions = [];
    for (const [id, session] of this.activeSessions) {
      if (session.status === 'active') {
        sessions.push({
          id,
          ...session,
          duration: Date.now() - session.startTime
        });
      }
    }
    return sessions;
  }

  /**
   * Clean up completed/cancelled sessions
   * @param {number} olderThan - Remove sessions older than this (ms)
   */
  cleanupSessions(olderThan = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [id, session] of this.activeSessions) {
      if (session.endTime && (now - session.endTime) > olderThan) {
        this.activeSessions.delete(id);
      }
    }
  }

  /**
   * Handle extraction progress events
   * @param {Function} callback - Progress callback
   */
  onProgress(callback) {
    this.ipcBridge.on('event', (message) => {
      if (message.type === 'extraction.progress' && message.payload) {
        const { sessionId } = message.payload;
        if (this.activeSessions.has(sessionId)) {
          callback(message.payload);
        }
      }
    });
  }

  /**
   * Batch extraction for multiple files
   * @param {Array} files - Array of file paths
   * @param {Object} options - Extraction options
   * @returns {Promise<Array>} Extraction results
   */
  async batchExtraction(files, options = {}) {
    const results = [];
    const errors = [];

    for (const file of files) {
      try {
        const result = await this.startExtraction({
          filePath: file,
          ...options
        });
        results.push({
          file,
          success: true,
          data: result
        });
      } catch (error) {
        errors.push({
          file,
          success: false,
          error: error.message
        });
      }
    }

    return {
      results,
      errors,
      total: files.length,
      successful: results.length,
      failed: errors.length
    };
  }
}

module.exports = ExtractionProtocol;