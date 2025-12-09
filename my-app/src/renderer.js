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
let videoStream = null; // Store video stream reference
let audioStream = null; // Store audio stream reference

// This function will be called when a video source is selected
async function selectSource(source) {
  console.log('Selected source:', source.name);
  console.log('Source ID:', source.id);
  
  /**
   * STEP 1: Get video stream (screen capture)
   * WHAT: Captures the screen/window video
   * HOW: Uses Electron's desktopCapturer with the selected source
   * WHY: Separated from audio for better control and error handling
   */
  const videoConstraints = {
    audio: false, // No audio in this stream
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id
      }
    }
  };
  
  /**
   * STEP 2: Get audio stream (microphone)
   * WHAT: Captures audio from the default microphone
   * HOW: Uses standard getUserMedia with audio constraints
   * WHY: Separated so we can handle mic permissions/errors independently
   */
  const audioConstraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    },
    video: false // No video in this stream
  };
  
  // Get both streams with independent error handling
  try {
    // Get video stream first
    videoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
    console.log('Video stream acquired');
    
    // Try to get audio stream (optional - recording continues even if this fails)
    try {
      audioStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('Audio stream acquired');
    } catch (audioError) {
      console.warn('Could not access microphone:', audioError);
      console.log('Continuing with video only');
      audioStream = null;
    }
    
    /**
     * STEP 3: Combine streams
     * WHAT: Merge video and audio tracks into one stream
     * HOW: Create new MediaStream and add all tracks
     * WHY: MediaRecorder needs a single stream with both video and audio tracks
     */
    const combinedStream = new MediaStream();
    
    // Add video tracks from screen capture
    videoStream.getVideoTracks().forEach(track => {
      combinedStream.addTrack(track);
    });
    
    // Add audio tracks from microphone (if available)
    if (audioStream) {
      audioStream.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
      });
    }
    
    // Set the video element's source to the combined stream
    videoElement.srcObject = combinedStream;
    videoElement.play();
    
    // Create media recorder with the combined stream
    const options = { mimeType: 'video/webm; codecs=vp9'}
    mediaRecorder = new MediaRecorder(combinedStream, options)

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

      // Clean up streams
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
      }

      // Clear recorded chunks for next recording
      recordedChunks.length = 0;
    }
    console.log('Stream started successfully with ' + 
      (audioStream ? 'video and audio' : 'video only'));
  } catch (error) {
    console.error('Error accessing video stream:', error);
    // Clean up any streams that were created
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
      audioStream = null;
    }
  }
}

// Listen for when user selects a source from the menu
window.electronAPI.onSourceSelected(selectSource);



videoSelectBtn.onclick = getVideoSources;

console.log(
  '👋 This message is being logged by "renderer.js", included via Vite',
);
