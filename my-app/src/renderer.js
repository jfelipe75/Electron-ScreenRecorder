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

// Start button - starts recording
startBtn.addEventListener('click', () => {
  if (mediaRecorder) {
    mediaRecorder.start();
    startBtn.classList.add('is-danger');
    startBtn.innerText = 'Recording';
    console.log('Recording started');
  } else {
    console.log('Please select a video source first');
  }
});

// Stop button - stops recording and saves file
stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    startBtn.classList.remove('is-danger');
    startBtn.innerText = 'Start';
    console.log('Recording stopped');
  }
});

// Get the available video sources on the user system to record
async function getVideoSources() {
  /**this method returns a promise so we need to use 
   * the await keyword to await the value. The value is
   * an array of objects where each object is a window or
   * a screen avalaible on the user's computer that we
   * can record**/
  const inputSources = await window.electronAPI.getVideoSources();
  console.log(inputSources);

  /**
   * Send the sources to main process to build and display the menu.
   * Main process will create a Menu with click handlers.
   * When a user clicks a menu item, main sends the selected source
   * back to us via the 'source-selected' event.
   */
  await window.electronAPI.showMenu(inputSources);
}
let mediaRecorder; // MediaRecorder instance to capture footage
const recordedChunks = [];
// This function will be called when a video source is selected
async function selectSource(source) {
  console.log('Selected source:', source.name);
  console.log('Source ID:', source.id);
  
  // Set up the media constraints for screen capture
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id
      }
    }
  };
  
  // Get the media stream from the selected source
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Set the video element's source to the stream
    videoElement.srcObject = stream;
    videoElement.play();
    // create media recorder
    const options = { mimeType: 'video/webm; codecs=vp9'}
    mediaRecorder = new MediaRecorder(stream, options)

    // register event handlers
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
    // captures all recorded chunks
    function handleDataAvailable(e) {
      console.log('video data available')
      recordedChunks.push(e.data)
    }
    
    // saves the video file on stop
    async function handleStop(e) {
      /** a blob is essentially just a data structure to handle raw data
       * like a video
       */
      const blob = new Blob(recordedChunks, {
        type: 'video/webm; codecs=vp9'
      });
      
      // Convert blob to buffer (ArrayBuffer is available in browser)
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Send to main process to save via IPC
      try {
        const filePath = await window.electronAPI.saveVideo(buffer);
        if (filePath) {
          console.log('Video saved successfully to:', filePath);
        } else {
          console.log('Save cancelled');
        }
      } catch (error) {
        console.error('Error saving video:', error);
      }

      // Clear recorded chunks for next recording
      recordedChunks.length = 0;
    }
    console.log('Stream started successfully');
  } catch (error) {
    console.error('Error accessing media devices:', error);
  }
}

// Listen for when user selects a source from the menu
window.electronAPI.onSourceSelected(selectSource);



videoSelectBtn.onclick = getVideoSources;

console.log(
  '👋 This message is being logged by "renderer.js", included via Vite',
);
