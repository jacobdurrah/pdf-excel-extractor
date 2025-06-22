const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const IPCBridge = require('./ipc-bridge');
const ExtractionProtocol = require('./protocols/extraction');

let mainWindow;
let extractionProtocol;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize IPC Bridge when app is ready
async function initializeBackend() {
  try {
    console.log('Initializing IPC Bridge...');
    await IPCBridge.initialize();
    
    // Create protocol handlers
    extractionProtocol = new ExtractionProtocol(IPCBridge);
    
    // Set up progress event forwarding
    extractionProtocol.onProgress((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('extraction-progress', progress);
      }
    });
    
    console.log('Backend initialized successfully');
  } catch (error) {
    console.error('Failed to initialize backend:', error);
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox('Initialization Error', 
      `Failed to initialize backend: ${error.message}\n\nPlease ensure Python 3.8+ is installed.`);
  }
}

// IPC handlers for communication with renderer
ipcMain.handle('process-pdf', async (event, fileData) => {
  try {
    const result = await extractionProtocol.startExtraction({
      filePath: fileData.path,
      mode: fileData.mode || 'automatic'
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('PDF processing error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-extraction-status', async (event, sessionId) => {
  try {
    const status = await extractionProtocol.getSessionStatus(sessionId);
    return { success: true, data: status };
  } catch (error) {
    console.error('Status check error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-field', async (event, { sessionId, fieldName, value }) => {
  try {
    const result = await extractionProtocol.updateField(sessionId, fieldName, value);
    return { success: true, data: result };
  } catch (error) {
    console.error('Field update error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('complete-extraction', async (event, sessionId) => {
  try {
    const result = await extractionProtocol.completeExtraction(sessionId);
    return { success: true, data: result };
  } catch (error) {
    console.error('Completion error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-extraction', async (event, sessionId) => {
  try {
    await extractionProtocol.cancelExtraction(sessionId);
    return { success: true };
  } catch (error) {
    console.error('Cancellation error:', error);
    return { success: false, error: error.message };
  }
});

// Get active sessions
ipcMain.handle('get-active-sessions', async (event) => {
  try {
    const sessions = extractionProtocol.getActiveSessions();
    return { success: true, data: sessions };
  } catch (error) {
    console.error('Get sessions error:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(async () => {
  createWindow();
  await initializeBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on exit
app.on('before-quit', async () => {
  console.log('Shutting down backend...');
  await IPCBridge.shutdown();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Log to file or send to monitoring service
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});