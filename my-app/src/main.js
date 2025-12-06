import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
/**app is used to control the lifecycle of the app
 * and it uses an event based API 
 * **/ 

import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    /**options object that configures how the renderer
     * (the web page) inside my browserWindow behaves
     * # I can think of it as setting for the mini browser
     * that lives inside this window
     */
    webPreferences: {

       //nodeIntegration: true, 
       /** --> your frontend code 
       * can do anything a Node script can — including 
       * accessing your whole computer. 
       * That’s why it’s risky.**/

      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      /** preload.js, runs first, before my webpage 
       * UI loads. It's a small setup file that prepares
       * everything my frontend will need.
       * 
       * Instead of giving your UI full Node powers, 
       * preload lets you choose:
       * “My UI is only allowed to do these few safe things.”
       * 
       * Now the UI cannot touch the file system 
       * directly. It must go through your safe API.
      */
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// IPC handler for getting video sources
ipcMain.handle('get-video-sources', async () => {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return inputSources;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
