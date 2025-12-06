/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

// buttons
const videoElement = document.querySelector('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const videoSelectBtn = document.getElementById('videoSelectBtn');
startBtn.addEventListener('click', () => {console.log('test')})

// Get the available video sources on the user system to record
async function getVideoSources() {
  /**this method returns a promise so we need to use 
   * the await keyword to await the value. The value is
   * an array of objects where each object is a window or
   * a screen avalaible on the user's computer that we
   * can record**/
  const inputSources = await window.electronAPI.getVideoSources();
  console.log(inputSources);
  
  // TODO: Create menu from sources
  /**
   * This method expects an array of objects where each 
   * object represents a diff menu item
   */
}

videoSelectBtn.onclick = getVideoSources;

console.log(
  '👋 This message is being logged by "renderer.js", included via Vite',
);
