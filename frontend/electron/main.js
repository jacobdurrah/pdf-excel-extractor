const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let pythonProcess;

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

// IPC handlers for communication with renderer
ipcMain.handle('process-pdf', async (event, fileData) => {
  // This will communicate with the Python backend
  // Implementation will be added when integrating with backend
  return { success: true, message: 'PDF processing started' };
});

ipcMain.handle('get-extraction-status', async (event, sessionId) => {
  // Check extraction status
  return { status: 'processing', progress: 50 };
});

app.whenReady().then(() => {
  createWindow();

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

// Cleanup Python process on exit
app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});