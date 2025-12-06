# Electron Screen Recorder - Architecture Documentation

## 📚 Introduction

This document explains how our Electron screen recorder application is structured and why we chose this architecture. Think of this guide as a tour of a house - we'll explore each room (file) and understand what happens there and why it matters.

---

## 🏗️ What is Electron?

Imagine you want to build a desktop application that works on Windows, Mac, and Linux. Normally, you'd need to learn different programming languages for each platform. Electron is like a universal translator - it lets you build desktop apps using web technologies (HTML, CSS, JavaScript) that work everywhere.

**The House Analogy:**
- **Main Process** = The house's foundation and electrical system (handles powerful operations)
- **Renderer Process** = The rooms where people live (the user interface)
- **Preload Script** = The security system that controls what passes between foundation and rooms

---

## 📁 File Structure Overview

```
my-app/
├── src/
│   ├── main.js         (The Brain - Main Process)
│   ├── preload.js      (The Security Guard)
│   ├── renderer.js     (The User Interface Logic)
│   ├── index.css       (The Styling)
│   └── index.html      (The User Interface Structure)
```

---

## 🧠 main.js - The Brain (Main Process)

**What it does:** Controls the entire application, creates windows, and handles powerful operations like accessing your screen.

### The Restaurant Kitchen Analogy
Think of `main.js` as the kitchen in a restaurant:
- Customers (users) can't enter the kitchen directly
- The kitchen has access to all the equipment and ingredients (your computer's resources)
- It prepares the meals (data) that get served to the dining room (user interface)

### Key Responsibilities:

#### 1. **App Lifecycle Management**
```javascript
app.whenReady().then(() => { createWindow(); });
```
Like a restaurant manager who opens the doors when everything is ready.

#### 2. **Creating the Application Window**
```javascript
const mainWindow = new BrowserWindow({
  width: 800,
  height: 600,
  webPreferences: { ... }
});
```
Creates the actual window you see on your screen - like setting up a dining room for customers.

#### 3. **Security Configuration**
```javascript
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload.js')
}
```

**Why this matters:**
- `contextIsolation: true` = Build a wall between the kitchen and dining room
- `nodeIntegration: false` = Don't let customers use kitchen equipment directly
- `preload` = Install a secure communication system (like an order speaker)

#### 4. **IPC (Inter-Process Communication) Handlers**
```javascript
ipcMain.handle('get-video-sources', async () => {
  const inputSources = await desktopCapturer.getSources({
    types: ['window', 'screen']
  });
  return inputSources;
});
```

**The Waiter System:**
- The UI (customer) places an order: "I want the list of screens"
- `ipcMain.handle` (the waiter) takes the order to the kitchen
- The kitchen prepares it using `desktopCapturer` (powerful equipment)
- The waiter brings back the result

---

## 🛡️ preload.js - The Security Guard

**What it does:** Acts as a secure bridge between the powerful main process and the user interface.

### The Bank Teller Analogy
Imagine a bank:
- The vault (main process) has all the money and power
- Customers (renderer process) can't enter the vault directly
- The bank teller (preload script) has a specific slot in the window where they only allow approved transactions

### Code Breakdown:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources')
});
```

**What's happening:**
1. `contextBridge` = The secure window between teller and customer
2. `exposeInMainWorld` = Creating a transaction slot labeled "electronAPI"
3. `getVideoSources` = The only approved transaction we allow
4. `ipcRenderer.invoke` = Send a message to the vault (main process)

### Why We Need This:

**❌ Without preload (dangerous):**
```javascript
// Renderer has full access - could do ANYTHING
const fs = require('fs');
fs.deleteEverything(); // Disaster!
```

**✅ With preload (safe):**
```javascript
// Renderer can only use approved functions
window.electronAPI.getVideoSources(); // Safe and controlled
```

---

## 🎨 renderer.js - The User Interface Logic

**What it does:** Handles user interactions, updates the display, and communicates with the main process through the safe API.

### The Smartphone App Analogy
Think of `renderer.js` as the app you see on your phone:
- It responds when you tap buttons
- It displays information on the screen
- It can request data from servers, but can't access your entire phone system

### Code Breakdown:

#### 1. **Getting UI Elements**
```javascript
const videoElement = document.querySelector('video');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const videoSelectBtn = document.getElementById('videoSelectBtn');
```
Grabbing references to buttons and the video player - like learning where all the controls are in your car.

#### 2. **Event Listeners**
```javascript
startBtn.addEventListener('click', () => {
  console.log('test')
});
```
Setting up reactions to user actions - "When someone clicks this button, do something."

#### 3. **Requesting Data Through Safe API**
```javascript
async function getVideoSources() {
  const inputSources = await window.electronAPI.getVideoSources();
  console.log(inputSources);
}
```

**The Food Delivery App:**
- You (renderer) click "Order Food" button
- The app calls `window.electronAPI.getVideoSources()` (places the order)
- The restaurant (main process) prepares it
- You receive the list of available screens/windows

---

## 🔐 Why This Architecture? (Security First)

### The Old Way (Dangerous):
```javascript
// renderer.js could do:
const { desktopCapturer } = require('electron');
const fs = require('fs');

// Now your UI has FULL access to the computer!
fs.unlinkSync('/important/file'); // Delete any file!
```

This is like giving every restaurant customer access to the kitchen - chaos!

### The New Way (Secure):
```javascript
// renderer.js can only:
window.electronAPI.getVideoSources(); // Request approved data

// That's it! No direct access to dangerous operations.
```

This is like customers ordering from a menu - they can only get what's been approved.

---

## 🔄 Complete Flow Example

Let's trace what happens when a user clicks the "Select Video Source" button:

1. **User clicks button** (in the browser/renderer)
   ```
   👤 User → [Click] → videoSelectBtn
   ```

2. **Renderer calls safe API** (renderer.js)
   ```javascript
   async function getVideoSources() {
     const inputSources = await window.electronAPI.getVideoSources();
   }
   ```
   📱 "Hey, I need the list of screens!"

3. **Preload forwards the request** (preload.js)
   ```javascript
   getVideoSources: () => ipcRenderer.invoke('get-video-sources')
   ```
   🛡️ "Let me check if that's allowed... yes, forwarding to main process."

4. **Main process handles the request** (main.js)
   ```javascript
   ipcMain.handle('get-video-sources', async () => {
     const inputSources = await desktopCapturer.getSources({
       types: ['window', 'screen']
     });
     return inputSources;
   });
   ```
   🧠 "I'll use my powerful access to get all screens and windows, then send it back."

5. **Data flows back through the chain**
   ```
   Main Process → Preload → Renderer → User sees the list
   ```

---

## 📊 Benefits of This Architecture

### 1. **Security** 🔒
- Renderer (UI) has minimal permissions
- Can't accidentally (or maliciously) harm the system
- Only approved operations are allowed

### 2. **Maintainability** 🛠️
- Clear separation of concerns
- Each file has one job
- Easy to find and fix bugs

### 3. **Scalability** 📈
- Want to add a new feature? Just add a new function to preload
- Main process stays organized
- Renderer stays simple

### 4. **Best Practices** ✅
- Follows Electron's official recommendations
- Passes security audits
- Compatible with modern build tools (Vite)

---

## 🎯 Key Takeaways

1. **main.js** = The powerful engine that runs everything
2. **preload.js** = The security guard that only allows safe operations
3. **renderer.js** = The pretty face that users interact with

Think of it like a bank:
- **Vault (main.js)** - Has all the power and money
- **Teller Window (preload.js)** - Controlled access point
- **Customer Lobby (renderer.js)** - Where users interact safely

This structure keeps your app **secure**, **organized**, and **easy to maintain**!

---

## 📚 Further Reading

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [IPC (Inter-Process Communication)](https://www.electronjs.org/docs/latest/tutorial/ipc)
