const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');
const MessageQueue = require('./message-queue');

/**
 * Python Process Manager
 * Handles Python subprocess lifecycle and version compatibility
 */
class PythonProcessManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.process = null;
    this.pythonPath = null;
    this.pythonVersion = null;
    this.scriptPath = options.scriptPath || path.join(__dirname, '../../backend/app/ipc_server.py');
    this.restartAttempts = 0;
    this.maxRestartAttempts = options.maxRestartAttempts || 3;
    this.restartDelay = options.restartDelay || 1000;
    this.messageQueue = new MessageQueue();
    this.isRestarting = false;
  }

  /**
   * Detect Python installation and version
   * @returns {Promise<Object>} Python info
   */
  async detectPython() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const candidates = [];
    
    // Platform-specific Python commands
    const pythonCommands = process.platform === 'win32' 
      ? ['python', 'python3', 'py -3']
      : ['python3', 'python'];

    for (const cmd of pythonCommands) {
      try {
        const { stdout } = await execPromise(`${cmd} --version`);
        const versionMatch = stdout.match(/Python (\d+)\.(\d+)\.(\d+)/);
        
        if (versionMatch) {
          const [, major, minor, patch] = versionMatch;
          const version = {
            major: parseInt(major),
            minor: parseInt(minor),
            patch: parseInt(patch),
            full: `${major}.${minor}.${patch}`,
            command: cmd
          };

          // Check if version meets minimum requirements (3.8+)
          if (version.major === 3 && version.minor >= 8) {
            candidates.push(version);
          }
        }
      } catch (error) {
        // Command not found, try next
        continue;
      }
    }

    if (candidates.length === 0) {
      throw new Error('Python 3.8 or higher not found. Please install Python from https://python.org');
    }

    // Select the best candidate (highest version)
    const selected = candidates.sort((a, b) => {
      if (a.major !== b.major) return b.major - a.major;
      if (a.minor !== b.minor) return b.minor - a.minor;
      return b.patch - a.patch;
    })[0];

    this.pythonPath = selected.command;
    this.pythonVersion = selected;

    return selected;
  }

  /**
   * Start the Python process
   * @returns {Promise<void>}
   */
  async start() {
    if (this.process) {
      throw new Error('Python process already running');
    }

    // Detect Python if not already done
    if (!this.pythonPath) {
      await this.detectPython();
    }

    console.log(`Starting Python ${this.pythonVersion.full} process...`);

    // Spawn Python process
    this.process = spawn(this.pythonPath, [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',  // Disable output buffering
        PYTHONIOENCODING: 'utf-8'  // Ensure UTF-8 encoding
      }
    });

    // Set up event handlers
    this.setupProcessHandlers();

    // Wait for process to be ready
    await this.waitForReady();

    this.emit('started', {
      pid: this.process.pid,
      version: this.pythonVersion
    });
  }

  /**
   * Set up process event handlers
   */
  setupProcessHandlers() {
    this.process.stdout.on('data', (data) => {
      this.emit('stdout', data);
    });

    this.process.stderr.on('data', (data) => {
      this.emit('stderr', data);
      console.error('Python stderr:', data.toString());
    });

    this.process.on('error', (error) => {
      console.error('Python process error:', error);
      this.emit('error', error);
      this.handleProcessError(error);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`Python process exited with code ${code} and signal ${signal}`);
      this.process = null;
      this.emit('exit', { code, signal });
      
      // Attempt restart if not graceful shutdown
      if (code !== 0 && !this.isRestarting) {
        this.handleUnexpectedExit(code, signal);
      }
    });
  }

  /**
   * Wait for Python process to be ready
   * @returns {Promise<void>}
   */
  async waitForReady() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Python process startup timeout'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('ready', onReady);
        this.removeListener('error', onError);
      };

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      this.once('ready', onReady);
      this.once('error', onError);

      // Send initial ping to check readiness
      this.checkReady();
    });
  }

  /**
   * Check if Python process is ready
   */
  checkReady() {
    if (!this.process || !this.process.stdin.writable) {
      return;
    }

    const pingMessage = JSON.stringify({
      id: 'startup-check',
      type: 'ping',
      timestamp: Date.now()
    }) + '\n';

    this.process.stdin.write(pingMessage);
  }

  /**
   * Send data to Python process
   * @param {string} data - Data to send
   */
  send(data) {
    if (!this.process || !this.process.stdin.writable) {
      throw new Error('Python process not available');
    }

    this.process.stdin.write(data);
  }

  /**
   * Handle process errors
   * @param {Error} error - Process error
   */
  handleProcessError(error) {
    if (error.code === 'ENOENT') {
      console.error(`Python executable not found: ${this.pythonPath}`);
      this.emit('error', new Error('Python executable not found. Please install Python 3.8+'));
    } else if (error.code === 'EACCES') {
      console.error('Permission denied when starting Python process');
      this.emit('error', new Error('Permission denied. Check file permissions.'));
    } else {
      console.error('Unexpected process error:', error);
    }
  }

  /**
   * Handle unexpected process exit
   * @param {number} code - Exit code
   * @param {string} signal - Exit signal
   */
  async handleUnexpectedExit(code, signal) {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('Max restart attempts reached. Giving up.');
      this.emit('fatal-error', new Error('Python process repeatedly failed to start'));
      return;
    }

    this.isRestarting = true;
    this.restartAttempts++;
    
    console.log(`Attempting to restart Python process (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);
    
    // Wait before restarting
    await new Promise(resolve => setTimeout(resolve, this.restartDelay));
    
    try {
      await this.start();
      this.restartAttempts = 0; // Reset on successful start
      this.isRestarting = false;
      this.emit('restarted');
    } catch (error) {
      console.error('Failed to restart Python process:', error);
      this.isRestarting = false;
      this.handleUnexpectedExit(1, null);
    }
  }

  /**
   * Stop the Python process gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('Graceful shutdown timeout, forcing termination...');
        this.process.kill('SIGKILL');
      }, 5000);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this.process = null;
        resolve();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');
    });
  }

  /**
   * Restart the Python process
   * @returns {Promise<void>}
   */
  async restart() {
    console.log('Restarting Python process...');
    await this.stop();
    await this.start();
  }

  /**
   * Get process statistics
   * @returns {Object} Process stats
   */
  getStats() {
    if (!this.process) {
      return {
        running: false,
        pid: null,
        uptime: 0,
        restartAttempts: this.restartAttempts
      };
    }

    return {
      running: true,
      pid: this.process.pid,
      uptime: process.uptime(), // Approximate, should track actual start time
      restartAttempts: this.restartAttempts,
      pythonVersion: this.pythonVersion?.full,
      queueStats: this.messageQueue.getStats()
    };
  }
}

module.exports = PythonProcessManager;