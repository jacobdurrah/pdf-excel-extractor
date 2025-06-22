const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  processPDF: (fileData) => ipcRenderer.invoke('process-pdf', fileData),
  getExtractionStatus: (sessionId) => ipcRenderer.invoke('get-extraction-status', sessionId),
  
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  
  // Security - no direct file system access
  // All file operations go through main process
});