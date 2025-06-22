const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Standalone IPC Bridge for testing without Electron
 * Handles message routing, queuing, and error handling
 */
class StandaloneIPCBridge extends EventEmitter {
  constructor() {
    super();
    this.pythonProcess = null;
    this.isConnected = false;
    this.pendingRequests = new Map();
    this.messageBuffer = '';
    this.requestCounter = 0;
    this.pythonPath = null;
    this.pythonVersion = null;
  }

  /**
   * Initialize the IPC bridge and start the Python backend
   */
  async initialize() {
    try {
      // Detect Python version and path
      await this.detectPython();
      
      // Start Python backend
      await this.startPythonBackend();
      
      console.log(`IPC Bridge initialized with Python ${this.pythonVersion}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize IPC Bridge:', error);
      throw error;
    }
  }

  /**
   * Detect available Python version and path
   */
  async detectPython() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Try python3 first, then python
    const pythonCommands = ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        const { stdout } = await execPromise(`${cmd} --version`);
        const versionMatch = stdout.match(/Python (\d+\.\d+\.\d+)/);
        
        if (versionMatch) {
          const version = versionMatch[1];
          const major = parseInt(version.split('.')[0]);
          const minor = parseInt(version.split('.')[1]);
          
          // Require Python 3.8+
          if (major >= 3 && minor >= 8) {
            this.pythonPath = cmd;
            this.pythonVersion = version;
            return;
          }
        }
      } catch (error) {
        // Try next command
        continue;
      }
    }

    throw new Error('Python 3.8+ not found. Please install Python 3.8 or higher.');
  }

  /**
   * Start the Python backend process
   */
  async startPythonBackend() {
    const backendPath = path.join(__dirname, '../../backend/app/ipc_server.py');
    
    this.pythonProcess = spawn(this.pythonPath, [backendPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1' // Ensure immediate output
      }
    });

    this.pythonProcess.stdout.on('data', (data) => {
      this.handlePythonOutput(data);
    });

    this.pythonProcess.stderr.on('data', (data) => {
      console.error('Python stderr:', data.toString());
    });

    this.pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      this.handlePythonError(error);
    });

    this.pythonProcess.on('exit', (code, signal) => {
      console.log(`Python process exited with code ${code} and signal ${signal}`);
      this.isConnected = false;
      this.emit('disconnected');
      
      // Reject all pending requests
      for (const [id, request] of this.pendingRequests) {
        request.reject(new Error('Python process terminated'));
      }
      this.pendingRequests.clear();
    });

    // Wait for Python to be ready
    await this.waitForConnection();
  }

  /**
   * Wait for Python backend to be ready
   */
  async waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python backend connection timeout'));
      }, 10000); // 10 second timeout

      const checkReady = () => {
        this.sendMessage({
          id: 'init-check',
          type: 'ping',
          timestamp: Date.now()
        });
      };

      this.once('connected', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        resolve();
      });

      // Check every 100ms
      const interval = setInterval(checkReady, 100);
      
      this.once('connected', () => {
        clearInterval(interval);
      });
    });
  }

  /**
   * Handle output from Python process
   */
  handlePythonOutput(data) {
    this.messageBuffer += data.toString();
    
    // Process complete messages (delimited by newlines)
    const messages = this.messageBuffer.split('\n');
    this.messageBuffer = messages.pop() || '';
    
    for (const message of messages) {
      if (message.trim()) {
        try {
          const parsed = JSON.parse(message);
          this.handleMessage(parsed);
        } catch (error) {
          console.error('Failed to parse Python message:', message, error);
        }
      }
    }
  }

  /**
   * Handle parsed message from Python
   */
  handleMessage(message) {
    // Debug log
    if (process.env.IPC_DEBUG) {
      console.log('[DEBUG] Received message:', JSON.stringify(message));
    }

    // Check for initialization response
    if (message.id === 'init-check' && message.type === 'pong') {
      this.emit('connected');
      return;
    }

    // Handle regular messages
    if (message.id && this.pendingRequests.has(message.id)) {
      const request = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      // Special handling for ping/pong
      if (message.type === 'pong') {
        request.resolve({});
        return;
      }
      
      if (message.status === 'success') {
        request.resolve(message.payload || {});
      } else if (message.status === 'error') {
        request.reject(new Error(message.error || 'Unknown error'));
      } else {
        // For messages without status (like pong), resolve with the whole message
        request.resolve(message);
      }
    } else if (message.type && message.type.includes('event')) {
      // Handle events (like progress updates)
      this.emit('event', message);
    }
  }

  /**
   * Send message to Python backend
   */
  sendMessage(message) {
    if (!this.pythonProcess || !this.pythonProcess.stdin.writable) {
      throw new Error('Python process not available');
    }

    const jsonMessage = JSON.stringify(message);
    this.pythonProcess.stdin.write(jsonMessage + '\n');
  }

  /**
   * Send request to Python backend and wait for response
   */
  async sendRequest(type, payload, timeout = 30000) {
    if (!this.isConnected) {
      throw new Error('Not connected to Python backend');
    }

    const id = `req-${++this.requestCounter}`;
    const request = {
      id,
      type,
      timestamp: Date.now(),
      payload
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${type}`));
      }, timeout);

      // Store request handler
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // Send request
      try {
        this.sendMessage(request);
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handle Python process errors
   */
  handlePythonError(error) {
    console.error('Python process error:', error);
    this.emit('error', error);
  }

  /**
   * Gracefully shut down the IPC bridge
   */
  async shutdown() {
    if (this.pythonProcess) {
      // Send shutdown message
      try {
        await this.sendRequest('shutdown', {}, 5000);
      } catch (error) {
        // Ignore errors during shutdown
      }

      // Kill process if still running
      if (!this.pythonProcess.killed) {
        this.pythonProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.pythonProcess && !this.pythonProcess.killed) {
            this.pythonProcess.kill('SIGKILL');
          }
        }, 5000);
      }
    }

    this.pendingRequests.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
module.exports = new StandaloneIPCBridge();