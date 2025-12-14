// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');
/**
 * context.bridge.exposeInMainWorld = add a new object called electronAPI to my window
 * getVideoSources = function that sends a message to the main process
 * ipcRenderer.invoke('get-video-sources') = sends label requests to the main process
 * 
 * We expose multiple functions in ONE object to avoid overwriting
 */
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources'),
  showMenu: (sources) => ipcRenderer.invoke('show-menu', sources),
  onSourceSelected: (callback) => ipcRenderer.on('source-selected', (_event, source) => callback(source)),
  saveVideo: (buffer) => ipcRenderer.invoke('save-video', buffer),
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer)
});