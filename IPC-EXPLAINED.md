# IPC Explained - Inter-Process Communication

## What is IPC?

**IPC = Inter-Process Communication**

IPC is how different parts of your Electron app talk to each other.

---

## The Problem IPC Solves

In Electron, you have **two separate processes** that can't directly access each other:

```
┌─────────────────┐         ┌─────────────────┐
│  Main Process   │    ?    │ Renderer Process│
│   (main.js)     │  <--->  │  (renderer.js)  │
│   The Brain     │         │   The UI        │
└─────────────────┘         └─────────────────┘
```

They're like **two separate programs** running at the same time:
- They have different memory spaces
- They can't see each other's variables
- They can't call each other's functions directly

**IPC is the communication system that connects them!**

---

## The Analogy: Two Buildings 🏢🏢

Imagine two office buildings:

### Building A (Main Process):
- Has all the important equipment and data
- Can access the computer's hardware
- Runs powerful operations

### Building B (Renderer Process):
- Has the pretty user interface
- Shows information to users
- Takes user input

**IPC = The phone lines between the buildings!**

Without IPC, they'd be isolated. With IPC, they can send messages back and forth.

---

## How IPC Works in Your Code

### 1. **Main Process** - Sets up a listener:

```javascript
ipcMain.handle('get-video-sources', async () => {
  //  ↑ ipcMain = The phone in the main building
  //     .handle() = "I'm ready to answer calls"
  //     'get-video-sources' = The phone number/channel
  
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return inputSources; // Send response back
});
```

📞 *"Main building here, phone number 'get-video-sources' is ready. When someone calls, I'll fetch the video sources and send them back."*

### 2. **Preload Script** - Creates the connection:

```javascript
ipcRenderer.invoke('get-video-sources')
//  ↑ ipcRenderer = The phone in the renderer building
//     .invoke() = Make a call and wait for response
//     'get-video-sources' = Dial this number
```

📞 *"Calling main building at extension 'get-video-sources', waiting for answer..."*

### 3. **The Complete Call:**

```
Renderer:  "I need video sources!"
           ↓ (calls via ipcRenderer)
IPC:       📞 Connecting...
           ↓ (message travels through IPC)
Main:      "Got your request! Fetching data..."
           ↓ (processes the request)
Main:      "Here's the data!"
           ↓ (sends response back via IPC)
IPC:       📞 Delivering response...
           ↓
Renderer:  "Received! Thanks!"
```

---

## Types of IPC in Electron

### **`ipcMain`** (in main.js):
- The receiver/handler in the main process
- Listens for messages from renderer

**Methods:**
```javascript
ipcMain.handle('channel-name', callback)  // Listen and respond
ipcMain.on('channel-name', callback)      // Just listen (no response)
```

### **`ipcRenderer`** (in preload.js):
- The sender from renderer side
- Sends messages to main process

**Methods:**
```javascript
ipcRenderer.invoke('channel-name')  // Send and wait for response
ipcRenderer.send('channel-name')    // Send without expecting response
```

---

## Complete Flow in Your App

Here's the complete journey of a message in your screen recorder app:

### Step 1: User Clicks Button (renderer.js)
```javascript
videoSelectBtn.onclick = getVideoSources;

async function getVideoSources() {
  const inputSources = await window.electronAPI.getVideoSources();
  console.log(inputSources);
}
```
👤 *"User clicked 'Select Video Source' button"*

### Step 2: Call Exposed API (preload.js)
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources')
});
```
🛡️ *"Forwarding request through secure bridge using IPC"*

### Step 3: Main Receives & Processes (main.js)
```javascript
ipcMain.handle('get-video-sources', async () => {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return inputSources;
});
```
🧠 *"Main process receives IPC message, fetches screens, sends back data"*

### Step 4: Data Returns to Renderer
```javascript
const inputSources = await window.electronAPI.getVideoSources();
// inputSources now contains the list of screens/windows!
```
✅ *"Renderer receives data via IPC and can display it to user"*

---

## Why You Need IPC

### ❌ Without IPC (doesn't work):

```javascript
// In renderer.js - THIS FAILS!
const { desktopCapturer } = require('electron');
// Error: desktopCapturer is undefined in renderer!
```

The renderer process doesn't have access to Electron's powerful APIs for security reasons.

### ✅ With IPC (works perfectly):

```javascript
// Renderer asks main via IPC
const sources = await window.electronAPI.getVideoSources();
// Main process does the work and sends back via IPC
```

The renderer safely requests data, and the main process (which has the power) handles it.

---

## Real-World Analogy: Restaurant 🍔

Think of your Electron app like a restaurant:

- **Kitchen (Main Process)** 
  - Has ovens, ingredients, cooking skills
  - Can do powerful operations
  - Hidden from customers

- **Dining Room (Renderer Process)** 
  - Has customers and menus
  - Pretty interface
  - Safe environment

- **Waiters (IPC)** 
  - Carry orders from dining room to kitchen
  - Bring food back to customers
  - Control what can be requested

Without waiters (IPC), customers can't get food from the kitchen!

---

## IPC Communication Patterns

### Pattern 1: Request-Response (invoke/handle)
**Use when:** You need data back from main process

```javascript
// Renderer/Preload
const result = await ipcRenderer.invoke('get-something');

// Main
ipcMain.handle('get-something', async () => {
  return someData;
});
```

### Pattern 2: One-Way Message (send/on)
**Use when:** Just sending information, no response needed

```javascript
// Renderer/Preload
ipcRenderer.send('log-event', 'User clicked button');

// Main
ipcMain.on('log-event', (event, message) => {
  console.log(message);
});
```

### Pattern 3: Main to Renderer
**Use when:** Main needs to notify renderer of changes

```javascript
// Main (after getting window reference)
mainWindow.webContents.send('update-data', newData);

// Preload (expose listener)
contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateData: (callback) => ipcRenderer.on('update-data', callback)
});

// Renderer
window.electronAPI.onUpdateData((event, data) => {
  console.log('Received update:', data);
});
```

---

## IPC Best Practices

### 1. ✅ Always Use Preload Script
```javascript
// ✅ GOOD: Expose only specific functions
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources')
});

// ❌ BAD: Exposing entire ipcRenderer
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
```

### 2. ✅ Use Descriptive Channel Names
```javascript
// ✅ GOOD: Clear and specific
ipcMain.handle('get-video-sources', ...)
ipcMain.handle('start-recording', ...)
ipcMain.handle('save-video-file', ...)

// ❌ BAD: Generic or unclear
ipcMain.handle('getData', ...)
ipcMain.handle('action1', ...)
```

### 3. ✅ Handle Errors
```javascript
// Main
ipcMain.handle('get-video-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen']
    });
    return sources;
  } catch (error) {
    console.error('Failed to get sources:', error);
    throw error;
  }
});

// Renderer
try {
  const sources = await window.electronAPI.getVideoSources();
} catch (error) {
  console.error('Error getting video sources:', error);
}
```

### 4. ✅ Validate Input
```javascript
ipcMain.handle('save-file', async (event, filePath, data) => {
  // Validate inputs before processing
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }
  if (!data) {
    throw new Error('No data provided');
  }
  
  // Now safe to proceed
  await fs.writeFile(filePath, data);
});
```

---

## Security Note 🔒

IPC is part of Electron's security model:

- **Renderer** has limited power (like a web page)
- **Main** has full power (can access file system, hardware, etc.)
- **IPC** is the controlled bridge between them

By using IPC with `contextIsolation: true` and preload scripts, you ensure:
- Renderer can only do what you explicitly allow
- Malicious code in renderer can't access dangerous APIs
- Your app is secure by design

---

## In Summary

**IPC** = The messaging system that lets your UI (renderer) communicate with the powerful backend (main process)

**In your code:**
- `ipcMain.handle()` = Main says "I'm listening for this type of request"
- `ipcRenderer.invoke()` = Renderer says "Send this request to main"
- The channel name (`'get-video-sources'`) = The label that connects them

**It's the bridge that makes Electron apps work!** 🌉

---

## Quick Reference

| Component | Location | Purpose | Example |
|-----------|----------|---------|---------|
| `ipcMain` | main.js | Listen for requests | `ipcMain.handle('channel', callback)` |
| `ipcRenderer` | preload.js | Send requests | `ipcRenderer.invoke('channel')` |
| `contextBridge` | preload.js | Expose safe API | `contextBridge.exposeInMainWorld(...)` |
| Channel Name | Both | Connect sender/receiver | `'get-video-sources'` |

---

## Further Reading

- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
