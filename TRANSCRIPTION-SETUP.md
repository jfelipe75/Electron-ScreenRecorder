# Audio Transcription Setup Documentation

## 📚 Learning Resources

Before diving in, here are some helpful resources:
- [Electron Documentation](https://www.electronjs.org/docs/latest/) - Official Electron guides
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text) - Speech-to-text documentation
- [Express.js Guide](https://expressjs.com/en/starter/installing.html) - Web framework basics
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API) - Browser APIs reference
- [Node.js File System](https://nodejs.org/api/fs.html) - Working with files in Node

---

## Overview
This document explains how we built an audio transcription feature that captures your voice during screen recording and converts it to text using OpenAI's Whisper API. 

**What this feature does:**
1. Records your screen and microphone simultaneously
2. When you stop recording, it saves the video file
3. Automatically extracts the audio and sends it to OpenAI
4. Displays the transcribed text in your console

**The tech stack:**
- **Electron** (Desktop app framework)
- **Express.js** (Backend web server)
- **OpenAI Whisper** (AI speech-to-text service)
- **MediaRecorder API** (Browser API for recording)

---

## Architecture Flow

```
┌─────────────────┐
│   User Action   │  Click "Stop Recording"
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ RENDERER PROCESS (Browser Context)                      │
│ ┌─────────────────────────────────────────────────┐    │
│ │ handleStop() Function                            │    │
│ │ 1. Combines recordedChunks into video Blob      │    │
│ │ 2. Saves video file via IPC                      │    │
│ │ 3. Creates audio Blob from same chunks           │    │
│ │ 4. Converts to Uint8Array buffer                 │    │
│ └─────────────────┬───────────────────────────────┘    │
└───────────────────┼───────────────────────────────────┘
                    │ IPC Call: transcribe-audio(buffer)
                    ▼
┌─────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js Context)                          │
│ ┌─────────────────────────────────────────────────┐    │
│ │ IPC Handler: 'transcribe-audio'                  │    │
│ │ 1. Converts Uint8Array → Node.js Buffer         │    │
│ │ 2. Creates FormData with audio file              │    │
│ │ 3. Sends HTTP POST to backend server             │    │
│ └─────────────────┬───────────────────────────────┘    │
└───────────────────┼───────────────────────────────────┘
                    │ HTTP POST: localhost:8080/api/stt
                    ▼
┌─────────────────────────────────────────────────────────┐
│ EXPRESS BACKEND (Node.js Server)                        │
│ ┌─────────────────────────────────────────────────┐    │
│ │ /api/stt Route Handler                           │    │
│ │ 1. Multer parses multipart/form-data             │    │
│ │ 2. Extracts audio buffer from request            │    │
│ │ 3. Creates File object for OpenAI                │    │
│ │ 4. Calls OpenAI Whisper API                      │    │
│ └─────────────────┬───────────────────────────────┘    │
└───────────────────┼───────────────────────────────────┘
                    │ API Call: client.audio.transcriptions.create()
                    ▼
┌─────────────────────────────────────────────────────────┐
│ OPENAI WHISPER API                                      │
│ Processes audio → Returns transcript                    │
└─────────────────┬───────────────────────────────────────┘
                  │ Response: { text: "Hello world..." }
                  ▼
          ← Returns through all layers ←
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ CONSOLE OUTPUT                                           │
│ === TRANSCRIPTION RESULT ===                            │
│ Transcript: Hello world...                              │
│ ===========================                              │
└─────────────────────────────────────────────────────────┘
```

---

## Code Changes Explained

### 1. Backend Package Configuration (`backend/package.json`)

#### What We Added:
```json
{
  "type": "module"
}
```

**Why this matters:**
- Tells Node.js to treat all `.js` files as **ES modules** (modern syntax)
- Allows us to use `import`/`export` instead of `require()`/`module.exports`
- **Learn more:** [Node.js ES Modules](https://nodejs.org/api/esm.html)

**Without this:** You'd see warnings like:
```
Warning: Module type not specified and doesn't parse as CommonJS
```

---

### 2. Backend Server (`backend/src/index.js`)

#### Current Code:
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get directory path (needed in ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes dynamically (after env vars loaded)
const { default: sttRoutes } = await import('./routes/stt.js');
app.use("/api", sttRoutes);

// Start server
const port = 8080;
app.listen(port, () => console.log(`listening at http://localhost:${port}`));
```

#### Breaking It Down:

**1. ES Module Path Handling:**
```javascript
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```
- **Problem:** ES modules don't have `__dirname` like CommonJS does
- **Solution:** Use `import.meta.url` (current file's URL) and convert it
- **What it does:** Gets the absolute path to the current directory
- **Learn more:** [import.meta](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta)

**2. Environment Variable Loading:**
```javascript
dotenv.config({ path: join(__dirname, '..', '.env') });
```
- **What:** Loads variables from `.env` file into `process.env`
- **Path:** Goes up one directory (`..`) from `src/` to find `backend/.env`
- **Why:** Keeps API keys secure and out of source control
- **Learn more:** [dotenv package](https://www.npmjs.com/package/dotenv)

**3. CORS Middleware:**
```javascript
app.use(cors());
```
- **CORS = Cross-Origin Resource Sharing**
- **The Problem:** 
  - Electron app runs on `file://` or `http://localhost:XXXX`
  - Backend runs on `http://localhost:8080`
  - Different origins = browser blocks the request (security)
- **The Solution:** 
  - CORS middleware adds HTTP headers that tell the browser "this is allowed"
  - Header added: `Access-Control-Allow-Origin: *`
- **Learn more:** [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

**4. JSON Body Parser:**
```javascript
app.use(express.json());
```
- **What:** Middleware that parses incoming JSON in request bodies
- **Why:** Without it, `req.body` would be undefined
- **When it runs:** On every incoming request, before your route handlers

**5. Dynamic Import (Critical!):**
```javascript
const { default: sttRoutes } = await import('./routes/stt.js');
```
- **Why dynamic?** Routes file uses `process.env.OPENAI_API_KEY`
- **Problem:** Normal imports happen *before* dotenv loads the .env file
- **Solution:** Use `await import()` to load routes *after* environment variables
- **Top-level await:** Only works because we added `"type": "module"`

---

### 3. Backend Route Handler (`backend/src/routes/stt.js`)

#### Current Code:
```javascript
import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/stt", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const fileBuffer = req.file.buffer;

    // Create File object (required by OpenAI SDK)
    const audioFile = new File(
      [fileBuffer], 
      'recording.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );

    console.log('Processing audio file:', {
      size: fileBuffer.length,
      mimeType: audioFile.type
    });

    // Call OpenAI Whisper API
    const transcription = await client.audio.transcriptions.create({
      file: audioFile, 
      model: "whisper-1",
    });

    const text = transcription.text;
    console.log('Transcription successful, length:', text.length);

    res.json({ transcript: text });
  } catch (err) {
    console.error("STT error:", err);
    res.status(500).json({ 
      error: "Failed to transcribe audio", 
      details: err.message 
    });
  }
});

export default router;
```

#### Breaking It Down:

**1. Multer Middleware:**
```javascript
const upload = multer({ storage: multer.memoryStorage() });
```
- **Multer:** Middleware for handling `multipart/form-data` (file uploads)
- **memoryStorage():** Keeps uploaded files in RAM (as Buffer), not disk
- **Why:** Faster, and we don't need to clean up temp files
- **Result:** File data available at `req.file.buffer`
- **Learn more:** [Multer Documentation](https://www.npmjs.com/package/multer)

**2. Route with Middleware:**
```javascript
router.post("/stt", upload.single("audio"), async (req, res) => {
```
- **"/stt":** Route path (full path: `/api/stt` because mounted at `/api`)
- **upload.single("audio"):** Expects ONE file field named "audio"
- **Execution flow:**
  1. Request arrives
  2. Multer parses multipart data
  3. Finds file field named "audio"
  4. Puts file in `req.file`
  5. Your handler runs

**3. File Object Creation:**
```javascript
const audioFile = new File(
  [fileBuffer], 
  'recording.webm',
  { type: req.file.mimetype || 'audio/webm' }
);
```
- **Why File, not Blob?** OpenAI SDK specifically requires File objects
- **Constructor:** `new File(bits, filename, options)`
  - `bits`: Array of data chunks (we have one: the buffer)
  - `filename`: Name of the file (doesn't affect processing)
  - `options`: Object with `type` property (MIME type)
- **MIME type:** Tells OpenAI what format the audio is
- **Learn more:** [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)

**4. OpenAI API Call:**
```javascript
const transcription = await client.audio.transcriptions.create({
  file: audioFile, 
  model: "whisper-1",
});
```
- **whisper-1:** OpenAI's speech-to-text model
- **Why this model:** Stable, production-ready, supports many languages
- **Response:** Object with `text` property containing the transcript
- **Learn more:** [OpenAI Whisper API Docs](https://platform.openai.com/docs/api-reference/audio/createTranscription)

---

### 4. Main Process IPC Handler (`my-app/src/main.js`)

#### New Imports:
```javascript
import fetch from 'node-fetch';
import FormData from 'form-data';
```

**Why node-fetch?**
- `fetch()` is a browser API for making HTTP requests
- **Browser:** Has `fetch()` built-in
- **Node.js:** Didn't have native `fetch()` until v18+ (and even then, it's experimental in older versions)
- **Solution:** `node-fetch` package provides browser-compatible `fetch()` in Node
- **Learn more:** [node-fetch on npm](https://www.npmjs.com/package/node-fetch)

**Why form-data?**
- Need to send files to backend using `multipart/form-data` encoding
- **Browser:** Has `FormData` constructor built-in
- **Node.js:** No built-in `FormData` (until very recent versions)
- **Solution:** `form-data` package provides this functionality
- **Learn more:** [form-data on npm](https://www.npmjs.com/package/form-data)

#### The IPC Handler:
```javascript
ipcMain.handle('transcribe-audio', async (event, audioBuffer) => {
  try {
    // Create form data with the audio file
    const formData = new FormData();
    formData.append('audio', Buffer.from(audioBuffer), {
      filename: 'recording.webm',
      contentType: 'audio/webm'
    });

    // Send to backend server
    const response = await fetch('http://localhost:8080/api/stt', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data; // { transcript: "..." }
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
});
```

#### Breaking It Down:

**1. IPC Handler Registration:**
```javascript
ipcMain.handle('transcribe-audio', async (event, audioBuffer) => {
```
- **ipcMain.handle:** Registers a handler for IPC calls from renderer
- **'transcribe-audio':** Channel name (must match renderer's invoke call)
- **async:** Can use `await` and return Promises
- **event:** Contains sender info (not used here)
- **audioBuffer:** Data sent from renderer (Uint8Array)
- **Learn more:** [Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main)

**2. Buffer Conversion:**
```javascript
Buffer.from(audioBuffer)
```
- **Input:** `audioBuffer` is a `Uint8Array` (JavaScript typed array)
- **Output:** Node.js `Buffer` (extends Uint8Array with extra methods)
- **Why convert:** 
  - FormData.append() works better with Node Buffer
  - Buffer has methods like `.toString()`, `.slice()` that Uint8Array doesn't
- **Tech detail:** Both are views over raw binary data
- **Learn more:** [Node.js Buffer Guide](https://nodejs.org/en/knowledge/advanced/buffers/how-to-use-buffers/)

**3. FormData Creation:**
```javascript
const formData = new FormData();
formData.append('audio', Buffer.from(audioBuffer), {
  filename: 'recording.webm',
  contentType: 'audio/webm'
});
```
- **FormData:** Creates `multipart/form-data` request body
- **append() method:**
  - **Arg 1** (`'audio'`): Field name (must match backend: `upload.single("audio")`)
  - **Arg 2** (Buffer): The actual file data
  - **Arg 3** (options):
    - `filename`: What the server sees as the file name (can be anything)
    - `contentType`: MIME type (tells server it's audio in WebM format)

**HTML Equivalent:**
```html
<form method="POST" enctype="multipart/form-data">
  <input type="file" name="audio">
</form>
```

**4. Critical Headers:**
```javascript
headers: formData.getHeaders()
```
- **Why critical:** Multipart data needs special boundary markers
- **What it returns:**
  ```javascript
  {
    'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'
  }
  ```
- **The boundary:** Random string that separates different parts of the form
- **What the request looks like:**
  ```
  ------WebKitFormBoundary7MA4YWxkTrZu0gW
  Content-Disposition: form-data; name="audio"; filename="recording.webm"
  Content-Type: audio/webm

  [Binary audio data here...]
  ------WebKitFormBoundary7MA4YWxkTrZu0gW--
  ```
- **Without this:** Backend receives garbled data and can't parse it
- **Learn more:** [Multipart Messages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)

**5. HTTP POST Request:**
```javascript
const response = await fetch('http://localhost:8080/api/stt', {
  method: 'POST',
  body: formData,
  headers: formData.getHeaders()
});
```
- **URL:** Our Express backend endpoint
- **method: 'POST':** Sending data to server (not GET)
- **body:** The FormData with our audio file
- **await:** Waits for server response before continuing

**6. Error Handling:**
```javascript
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}
```
- **response.ok:** True if status code is 200-299
- **Status codes:**
  - `200`: Success
  - `400`: Bad request (missing data)
  - `500`: Server error (backend crashed)
- **Throwing error:** Caught by renderer's try/catch block

---

### 5. Preload Bridge (`my-app/src/preload.js`)

#### Addition:
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources'),
  showMenu: (sources) => ipcRenderer.invoke('show-menu', sources),
  onSourceSelected: (callback) => ipcRenderer.on('source-selected', (_event, source) => callback(source)),
  saveVideo: (buffer) => ipcRenderer.invoke('save-video', buffer),
  transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer)
});
```

#### Breaking It Down:

**What is contextBridge?**
- **Security layer** in Electron that protects the renderer process
- **The problem:**
  - Renderer runs web content (potentially untrusted)
  - Main process has full Node.js/OS access
  - Can't let renderer access everything (security risk)
- **The solution:**
  - Use `contextBridge` to expose *only* specific, safe functions
  - Creates a "bridge" between isolated contexts
- **Learn more:** [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)

**How it works:**
```javascript
contextBridge.exposeInMainWorld('electronAPI', { ... })
```
1. Creates a global object called `electronAPI`
2. Available in renderer as `window.electronAPI`
3. Contains only the functions you explicitly allow
4. Renderer has no other access to Node.js or Electron APIs

**Our transcription method:**
```javascript
transcribeAudio: (audioBuffer) => ipcRenderer.invoke('transcribe-audio', audioBuffer)
```
- **In renderer:** `window.electronAPI.transcribeAudio(buffer)`
- **In preload:** Forwards to `ipcRenderer.invoke('transcribe-audio', buffer)`
- **In main:** Handled by `ipcMain.handle('transcribe-audio', ...)`
- **Flow:** Renderer → Preload → Main Process

**Why this architecture?**
- **Security:** Renderer can't access file system directly
- **Control:** We decide exactly what functions are available
- **Safety:** Renderer can't accidentally crash the main process

---

### 6. Renderer Process (`my-app/src/renderer.js`)

#### The Recording Flow:

```javascript
// Global variables
let mediaRecorder; 
const recordedChunks = [];
let videoStream = null;
let audioStream = null;
```

**recordedChunks array:**
- Stores all the recorded data as it's being captured
- Each "chunk" is a Blob (binary data piece)
- MediaRecorder fills this array as you record
- **Learn more:** [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)

#### The Transcription Code in handleStop():

```javascript
// Send audio to OpenAI for transcription
if (audioStream) {  // Only if microphone was captured
  try {
    console.log('Sending audio for transcription...');
    
    // STEP 1: Create audio-only blob from recorded chunks
    const audioBlob = new Blob(recordedChunks, {
      type: 'audio/webm'
    });
    
    // STEP 2: Convert Blob to ArrayBuffer
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    
    // STEP 3: Wrap ArrayBuffer in Uint8Array
    const audioBuffer = new Uint8Array(audioArrayBuffer);
    
    // STEP 4: Send via IPC to main process
    const transcriptionResult = await window.electronAPI.transcribeAudio(audioBuffer);
    
    // STEP 5: Display the result
    console.log('=== TRANSCRIPTION RESULT ===');
    console.log('Transcript:', transcriptionResult.transcript);
    console.log('===========================');
  } catch (transcriptionError) {
    console.error('Error transcribing audio:', transcriptionError);
  }
}
```

#### Breaking It Down:

**Step 1: Creating the Audio Blob**
```javascript
const audioBlob = new Blob(recordedChunks, {
  type: 'audio/webm'
});
```
- **Blob:** "Binary Large Object" - container for raw binary data
- **recordedChunks:** Array of smaller Blobs from MediaRecorder
- **What happens:** All chunks get combined into one big Blob
- **type: 'audio/webm':** Tells the system it's WebM audio format
- **Key insight:** Same chunks used for video file! We're reusing them
- **Learn more:** [Blob API](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

**Step 2: Blob → ArrayBuffer**
```javascript
const audioArrayBuffer = await audioBlob.arrayBuffer();
```
- **Why convert?** Blob is an object with methods; IPC needs raw data
- **ArrayBuffer:** Fixed-length container of raw binary data
- **await:** This is async (reads the blob's internal data)
- **Result:** Raw bytes in memory
- **Analogy:** 
  - Blob = a sealed envelope (you know what's in it but can't access directly)
  - ArrayBuffer = opened envelope (raw data you can work with)
- **Learn more:** [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)

**Step 3: ArrayBuffer → Uint8Array**
```javascript
const audioBuffer = new Uint8Array(audioArrayBuffer);
```
- **Why another conversion?** ArrayBuffer can't be directly used
- **Uint8Array:** "View" into the ArrayBuffer as unsigned 8-bit integers
- **What this means:** Treat raw data as array of numbers (0-255)
- **Each element:** One byte of your audio file
- **Why Uint8?** 
  - "Uint" = Unsigned integer (no negative numbers)
  - "8" = 8 bits = 1 byte
  - Perfect for binary file data
- **IPC compatibility:** Uint8Array can be JSON-serialized (sent over IPC)
- **Learn more:** [Typed Arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray)

**Analogy for the conversion chain:**
```
Blob (Sealed Box) 
  ↓ .arrayBuffer()
ArrayBuffer (Warehouse of raw data)
  ↓ new Uint8Array()
Uint8Array (Array of bytes you can access)
  ↓ IPC
Main Process → Backend → OpenAI
```

**Step 4: IPC Communication**
```javascript
const transcriptionResult = await window.electronAPI.transcribeAudio(audioBuffer);
```
- **window.electronAPI:** Exposed by preload script via contextBridge
- **transcribeAudio():** Our custom method that wraps `ipcRenderer.invoke()`
- **audioBuffer:** The Uint8Array (serialized to JSON for IPC)
- **await:** Waits for main process to forward to backend and get response
- **Result:** `{ transcript: "your spoken words here" }`

**Step 5: Display Result**
```javascript
console.log('=== TRANSCRIPTION RESULT ===');
console.log('Transcript:', transcriptionResult.transcript);
console.log('===========================');
```
- **transcriptionResult.transcript:** The text from OpenAI
- **Future enhancement:** Could display in UI instead of console

---

## 🚀 Setup and Installation Guide

### Prerequisites
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **Code editor** (VS Code recommended)

### Step-by-Step Setup

**1. Install Backend Dependencies**
```bash
cd backend
npm install
```

**This installs:**
- `express` - Web server framework
- `cors` - Cross-origin request handling  
- `dotenv` - Environment variable loader
- `multer` - File upload middleware
- `openai` - OpenAI SDK for Whisper API

**2. Create .env File**
```bash
# In backend/ directory
touch .env
```

**Add your API key:**
```env
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

⚠️ **Security tips:**
- Never commit `.env` to git
- Add `.env` to `.gitignore`
- Don't share your API key publicly

**3. Install Electron App Dependencies**
```bash
cd ../my-app
npm install
```

**This includes:**
- `node-fetch@2` - HTTP requests in Node.js
- `form-data` - Multipart form data builder
- All Electron and build tool dependencies

**4. Start the Backend Server**
```bash
cd ../backend
node src/index.js
```

**You should see:**
```
Environment variables loaded
API Key exists: true
API Key length: 164
listening at http://localhost:8080
```

**5. Start the Electron App** (in new terminal)
```bash
cd my-app
npm start
```

**6. Test the Feature**
1. Click "Choose Video Source"
2. Select a screen/window
3. Click "Start" to begin recording
4. Speak into your microphone
5. Click "Stop" 
6. Check console for transcript!

---

## 🧠 Core Concepts Deep Dive

### 📦 recordedChunks Array

**What is it?**
```javascript
const recordedChunks = [];
```
- An array that stores **Blob chunks** of recorded media data
- Each chunk represents a piece of the recording

**Visual representation:**
```
Recording Timeline:  [-------- 30 seconds --------]
                     
MediaRecorder:       [Chunk1][Chunk2][Chunk3][Chunk4]
                        ↓       ↓       ↓       ↓
recordedChunks:     [Blob1, Blob2, Blob3, Blob4]
```

**How does it work?**
```javascript
mediaRecorder.ondataavailable = handleDataAvailable;

function handleDataAvailable(e) {
  recordedChunks.push(e.data);  // e.data is a Blob
}
```

**Why chunks instead of one big blob?**
1. **Memory efficiency:** Browser doesn't need to hold entire video in RAM at once
2. **Progressive saving:** Could save chunks as they arrive (streaming)
3. **Failure recovery:** If recording crashes, you still have earlier chunks
4. **MediaRecorder API design:** The API naturally produces chunks

**When does MediaRecorder create chunks?**
- When `mediaRecorder.stop()` is called
- At regular intervals (configurable via `timeslice` parameter)
- Example: `mediaRecorder.start(1000)` = create chunk every 1 second

**Reassembling chunks:**
```javascript
const blob = new Blob(recordedChunks, {
  type: 'video/webm; codecs=vp9'
});
```
- Takes all chunks and combines them into one Blob
- Like combining torn pages back into a complete book

---

### 🎯 Blob Constructor

**What is a Blob?**
- **Blob = Binary Large Object**
- Represents immutable raw data (images, videos, audio, files)
- Can represent data not necessarily in JavaScript-native format
- Think of it as a "file in memory"

**Blob Constructor Syntax:**
```javascript
new Blob(array, options)
```

**First Argument - `array`:**
```javascript
new Blob([chunk1, chunk2, chunk3], ...)
```
- Array of data pieces to combine
- Can contain:
  - Other Blobs
  - ArrayBuffers
  - TypedArrays (Uint8Array, etc.)
  - Strings
- **Example:**
```javascript
const blob1 = new Blob(['Hello '], { type: 'text/plain' });
const blob2 = new Blob(['World!'], { type: 'text/plain' });
const combined = new Blob([blob1, blob2], { type: 'text/plain' });
// Combined blob contains "Hello World!"
```

**Second Argument - `options` object:**
```javascript
{
  type: 'video/webm; codecs=vp9'  // MIME type
}
```
- **type:** MIME type of the data
  - `'video/webm'` - WebM video format
  - `'audio/webm'` - WebM audio format
  - `'image/png'` - PNG image
  - `'text/plain'` - Plain text
  - `'application/json'` - JSON data

**Why specify type?**
- Tells browsers/servers how to handle the data
- Affects download filename extensions
- Required for proper playback/display

**Our Usage:**
```javascript
// Combine all video chunks
const blob = new Blob(recordedChunks, {
  type: 'video/webm; codecs=vp9'
});

// Create audio-only version from same chunks
const audioBlob = new Blob(recordedChunks, {
  type: 'audio/webm'
});
```
- Same data (`recordedChunks`)
- Different type metadata
- Audio blob tells player to ignore video track

---

### 🔢 ArrayBuffer and Uint8Array

**The Problem:**
- JavaScript originally couldn't handle binary data efficiently
- Strings are inefficient for binary (video, images, etc.)
- Needed a way to work with raw bytes

**The Solution - Typed Arrays:**

#### ArrayBuffer
```javascript
const buffer = new ArrayBuffer(16);  // 16 bytes of memory
```
- **Fixed-length** raw binary data buffer
- Like allocating a chunk of RAM
- You **cannot** directly read/write it
- Just a storage container

**Real-world analogy:**
- ArrayBuffer = a warehouse (just empty space)
- You need a "view" to interact with the space

#### TypedArray Views (like Uint8Array)
```javascript
const view = new Uint8Array(buffer);
```
- **"View"** into an ArrayBuffer
- Lets you read/write the buffer as specific data types
- **Uint8Array** = array of 8-bit unsigned integers (0-255)
- Each element = 1 byte

**Different view types:**
```javascript
const buffer = new ArrayBuffer(16);

const uint8View = new Uint8Array(buffer);    // 16 elements (0-255)
const uint16View = new Uint16Array(buffer);  // 8 elements (0-65535)
const float32View = new Float32Array(buffer); // 4 elements (floating point)
```
- Same buffer, different interpretations
- Like viewing the same data as numbers vs. text

#### Converting Blob to Uint8Array

**Step 1: Blob → ArrayBuffer**
```javascript
const arrayBuffer = await blob.arrayBuffer();
```
- `blob.arrayBuffer()` reads the blob's data
- Returns a **Promise** (async operation)
- Result: Raw binary data in ArrayBuffer format

**Step 2: ArrayBuffer → Uint8Array**
```javascript
const uint8Array = new Uint8Array(arrayBuffer);
```
- Creates a view of the ArrayBuffer
- Now we can access individual bytes
- Can send over IPC (JSON-serializable)

**Why this conversion?**
```javascript
// ❌ Cannot send Blob directly over IPC
await window.electronAPI.transcribeAudio(blob);  // Won't work!

// ✅ Can send Uint8Array
const buffer = new Uint8Array(await blob.arrayBuffer());
await window.electronAPI.transcribeAudio(buffer);  // Works!
```
- **IPC requires JSON-serializable data**
- Blobs are objects with methods (not serializable)
- Uint8Array is just an array of numbers (serializable)
- Main process receives `[0, 255, 12, 88, ...]`

**In the main process:**
```javascript
const nodeBuffer = Buffer.from(audioBuffer);
```
- Converts Uint8Array back to Node.js Buffer
- Node.js Buffer has methods for file I/O
- Can be sent to backend server

---

### 🌐 Why CORS Matters

**The Browser Security Problem:**

1. **Same-Origin Policy:**
   - Browsers block requests between different origins
   - Origin = protocol + domain + port
   - Examples:
     - `http://localhost:3000` ≠ `http://localhost:8080` (different port)
     - `http://example.com` ≠ `https://example.com` (different protocol)
     - `http://api.example.com` ≠ `http://example.com` (different subdomain)

2. **Your Setup:**
   - Electron app: `file://` or `http://localhost:XXXX`
   - Backend server: `http://localhost:8080`
   - **Different origins = blocked by default**

3. **Without CORS:**
```
Browser: "I want to call http://localhost:8080/api/stt"
Server: "Here's the response!"
Browser: "Wait, you're not from my origin. BLOCKED!" ❌
```

4. **With CORS:**
```javascript
app.use(cors());  // In Express server
```
```
Browser: "I want to call http://localhost:8080/api/stt"
Server: "Here's the response + Access-Control-Allow-Origin: *"
Browser: "Server says it's okay. Allowing it!" ✅
```

**CORS Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Content-Type
```
- `*` = allow requests from any origin
- More secure: specify exact origins

**Production Configuration:**
```javascript
// Only allow your Electron app
app.use(cors({
  origin: 'http://localhost:5173'  // Your Electron app's URL
}));
```

---

## Complete Data Flow Example

### Recording Phase:
```javascript
1. User speaks into microphone
2. MediaRecorder captures audio in chunks
3. Each chunk stored in recordedChunks array
   recordedChunks = [Blob(chunk1), Blob(chunk2), Blob(chunk3)]
```

### Stop Recording:
```javascript
4. User clicks stop button
5. handleStop() function executes
6. Combine chunks into one blob:
   const blob = new Blob(recordedChunks, { type: 'video/webm' })
```

### Prepare for IPC:
```javascript
7. Convert Blob to ArrayBuffer:
   const arrayBuffer = await blob.arrayBuffer()
   // arrayBuffer = raw binary data (not directly usable)

8. Wrap in Uint8Array:
   const buffer = new Uint8Array(arrayBuffer)
   // buffer = [0, 255, 12, 88, ...] (array of bytes)
```

### Send to Main Process:
```javascript
9. Renderer calls IPC:
   window.electronAPI.transcribeAudio(buffer)
   
10. Preload forwards:
    ipcRenderer.invoke('transcribe-audio', buffer)
    
11. Main process receives:
    ipcMain.handle('transcribe-audio', (event, audioBuffer) => {
      // audioBuffer is Uint8Array from renderer
    })
```

### Forward to Backend:
```javascript
12. Convert to Node.js Buffer:
    const nodeBuffer = Buffer.from(audioBuffer)
    
13. Create FormData:
    const formData = new FormData()
    formData.append('audio', nodeBuffer, {
      filename: 'recording.webm',
      contentType: 'audio/webm'
    })
    
14. Send HTTP request:
    const response = await fetch('http://localhost:8080/api/stt', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    })
```

### Backend Processing:
```javascript
15. Express receives request
16. CORS middleware: adds Access-Control headers
17. Multer middleware: parses multipart/form-data
18. Route handler: extracts audio file
19. OpenAI API: transcribes audio
20. Return transcript to Electron
```

### Display Result:
```javascript
21. Main process returns transcript to renderer
22. Renderer logs to console:
    console.log('Transcript:', transcriptionResult.transcript)
```

---

## Package Dependencies Explained

### Backend Packages:
```json
{
  "express": "^5.2.1",      // Web server framework
  "cors": "^2.8.5",         // Cross-origin request handling
  "dotenv": "^17.2.3",      // Environment variable loader
  "multer": "^2.0.2",       // Multipart form parser (file uploads)
  "openai": "^6.10.0"       // OpenAI API client
}
```

### Electron App Packages:
```json
{
  "node-fetch": "^2.0.0",   // HTTP requests in Node.js
  "form-data": "^4.0.0"     // Multipart form data builder
}
```

**Why node-fetch@2 specifically?**
- Version 3+ is ESM-only (ES modules)
- Electron Forge might use CommonJS
- Version 2 supports both module systems
- More compatible with older build tools

---

## 🔧 Troubleshooting Guide

### Error: "CORS policy blocked"
```
Access to fetch at 'http://localhost:8080/api/stt' from origin
'http://localhost:5173' has been blocked by CORS policy
```

**What it means:**
- Browser is blocking cross-origin request
- Your Electron app and backend are on different origins

**Solution:**
1. Check `app.use(cors())` is in `backend/src/index.js`
2. Restart the backend server
3. Clear browser cache if needed

**Learn more:** [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

### Error: "Cannot find module 'node-fetch'"
```
Error: Cannot find module 'node-fetch'
```

**What it means:**
- The `node-fetch` package isn't installed in your Electron app

**Solution:**
```bash
cd my-app
npm install node-fetch@2 form-data
```

**Why version 2?** Version 3+ is ESM-only and may have compatibility issues

---

### Error: "Missing credentials"/"OPENAI_API_KEY is not defined"
```
OpenAIError: Missing credentials. Please pass an `apiKey`, or set 
the `OPENAI_API_KEY` environment variable.
```

**What it means:**
- The `.env` file isn't being loaded, or
- The API key is missing/incorrect

**Solutions:**

1. **Check .env file exists:**
```bash
cd backend
ls -la | grep .env  # Should see .env file
```

2. **Check .env content:**
```env
OPENAI_API_KEY=sk-proj-your-actual-key-here
```
⚠️ No quotes around the key!
⚠️ No spaces before/after the =

3. **Run from correct directory:**
```bash
cd backend
node src/index.js  # NOT: cd backend/src && node index.js
```

4. **Check environment loading:**
Look for console output:
```
Environment variables loaded
API Key exists: true
API Key length: 164
```

**Learn more:** [dotenv troubleshooting](https://github.com/motdotla/dotenv#faq)

---

### Error: HTTP 500 "Failed to transcribe audio"
```
Error transcribing audio: Error: HTTP error! status: 500
```

**What it means:**
- Backend server crashed while processing
- Check backend terminal for actual error

**Common causes:**

1. **Invalid File object** - Check backend logs for:
```
TypeError: File is not a constructor
```
**Solution:** Make sure you're using Node v18+ (has global File constructor)

2. **OpenAI API error** - Check logs for:
```
OpenAI API error: insufficient_quota
```
**Solution:** Add credits to your OpenAI account

3. **Invalid audio format** - Check logs for:
```
Invalid file format
```
**Solution:** Ensure recording is WebM audio format

---

### Error: "No transcript in console"

**Checklist:**

1. **Is microphone captured?**
```javascript
// Check renderer console for:
"Audio stream acquired"
```
If you see "Could not access microphone", grant mic permissions

2. **Is audioStream defined?**
```javascript
// In handleStop(), add debug log:
console.log('audioStream exists?', !!audioStream);
```

3. **Is backend receiving request?**
```javascript
// Backend should log:
"Processing audio file: { size: 123456, mimeType: 'audio/webm' }"
```

4. **Check network tab:**
- Open DevTools (Ctrl+Shift+I)
- Go to Network tab
- Look for POST to `http://localhost:8080/api/stt`
- Check response status and body

---

### Error: "Module type not specified" warning
```
[MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type not specified
```

**What it means:**
- `package.json` missing `"type": "module"` field

**Solution:**
```json
{
  "type": "module",
  "dependencies": { ... }
}
```

Add this to `backend/package.json`

---

### Backend won't start / crashes immediately

**Check:**

1. **Port 8080 already in use?**
```bash
# Windows
netstat -ano | findstr :8080

# Mac/Linux
lsof -i :8080
```
**Solution:** Kill the other process or use a different port

2. **Syntax errors?**
Run with more details:
```bash
node --trace-warnings src/index.js
```

3. **Missing dependencies?**
```bash
npm install
```

---

### No audio in recording

**Checklist:**

1. **Microphone permission granted?**
- Check browser/Electron permissions
- On Windows: Settings → Privacy → Microphone

2. **Correct audio constraints?**
```javascript
// In renderer.js, check:
const audioConstraints = {
  audio: { ... },  // Should have audio settings
  video: false
};
```

3. **Check combined stream:**
```javascript
// After combining streams, add debug:
console.log('Audio tracks:', combinedStream.getAudioTracks().length);
// Should be > 0
```

---

## ✅ Testing Checklist

**Backend Setup:**
- [ ] `backend/package.json` has `"type": "module"`
- [ ] `.env` file exists in `backend/` directory
- [ ] `.env` contains valid `OPENAI_API_KEY` (no quotes)
- [ ] Backend dependencies installed (`npm install`)
- [ ] Server starts without errors
- [ ] Console shows "listening at http://localhost:8080"
- [ ] Console shows "API Key exists: true"

**Electron App Setup:**
- [ ] Electron dependencies installed (`npm install`)
- [ ] `node-fetch@2` and `form-data` installed
- [ ] App starts without errors

**Recording Test:**
- [ ] Click "Choose Video Source" works
- [ ] Can select screen/window
- [ ] Click "Start" begins recording
- [ ] Video preview shows (muted)
- [ ] Microphone permission granted
- [ ] Console shows "Audio stream acquired"
- [ ] Click "Stop" stops recording
- [ ] Save dialog appears
- [ ] Video file saves successfully

**Transcription Test:**
- [ ] Console shows "Sending audio for transcription..."
- [ ] Backend logs show "Processing audio file..."
- [ ] No CORS errors in console
- [ ] No HTTP 500 errors
- [ ] Console shows "=== TRANSCRIPTION RESULT ==="
- [ ] Transcript text appears correctly
- [ ] Transcript matches what was spoken

---

## 📚 Additional Resources

**Official Documentation:**
- [Electron Docs](https://www.electronjs.org/docs/latest) - Complete Electron guide
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference) - All OpenAI APIs
- [Express.js Guide](https://expressjs.com/en/guide/routing.html) - Routing and middleware
- [MDN Web APIs](https://developer.mozilla.org/en-US/docs/Web/API) - All browser APIs

**Key APIs Used:**
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) - Recording audio/video
- [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) - Binary data handling
- [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) - Raw binary buffer
- [Typed Arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays) - Uint8Array, etc.
- [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) - Multipart form data
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - HTTP requests

**Learning Resources:**
- [JavaScript.info](https://javascript.info/) - Modern JavaScript tutorial
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) - Node.js guide
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security) - Security best practices

**Video Tutorials:**
- [Electron Crash Course](https://www.youtube.com/results?search_query=electron+crash+course)
- [Express.js Tutorial](https://www.youtube.com/results?search_query=express+js+tutorial)
- [OpenAI API Tutorial](https://www.youtube.com/results?search_query=openai+api+tutorial)

---

## 🎯 Summary

This transcription feature demonstrates a complete full-stack application:

**Frontend (Renderer):**
- Captures screen + microphone using MediaRecorder API
- Handles binary data conversions (Blob → ArrayBuffer → Uint8Array)
- Communicates with main process via secure IPC

**Main Process (Electron):**
- Acts as bridge between renderer and backend
- Converts data formats (Uint8Array → Buffer)
- Makes HTTP requests with FormData

**Backend (Express):**
- Receives multipart/form-data uploads
- Processes binary audio files
- Integrates with OpenAI Whisper API
- Returns structured JSON responses

**Key Technologies:**
- ✅ **IPC** - Inter-process communication in Electron
- ✅ **Binary Data** - Blob, ArrayBuffer, Uint8Array, Buffer
- ✅ **HTTP/REST** - POST requests with multipart data
- ✅ **CORS** - Cross-origin resource sharing
- ✅ **Environment Variables** - Secure credential storage
- ✅ **Async/Await** - Modern asynchronous JavaScript
- ✅ **AI Integration** - OpenAI Whisper speech-to-text

**What You Learned:**
1. How Electron's security model works (context isolation, IPC)
2. How to handle binary file data in JavaScript
3. How multipart/form-data encoding works
4. How to build and integrate with REST APIs
5. How to structure a full-stack Electron application

**Next Steps:**
- Display transcript in UI
- Save transcript alongside video
- Add real-time transcription
- Support multiple languages
- Generate subtitles from transcript

---

## 🤝 Need Help?

**Common Resources:**
- Check the error message first
- Look in backend console for detailed errors
- Check browser DevTools console
- Use Network tab to inspect HTTP requests
- Add `console.log()` to debug data flow

**Getting Support:**
- [Electron Discord](https://discord.gg/electron)
- [Stack Overflow - Electron](https://stackoverflow.com/questions/tagged/electron)
- [OpenAI Community Forum](https://community.openai.com/)

Good luck building! 🚀
