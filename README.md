# Electron Project structure

**Index.html:**is the entry point to our front end UI or the render process

**main.js:**is the entry point to our main process

### electron commands

**npx create-electron-app:** 
- initialize npm
- install electron, electron-forge(or electron builder), bundlers, etc.
- Configure entry points
- Handle packaging/build scripts
- write boilerplate just to open a browserWindow
 
 This command skips all that pain and lets us jump straight into:
 - editing UI
 - writing logic

**npm start:** runs Electron app

**rs:** updates electron app to reflect the source code.

### Electron facts
our app has one main process but it can have multiple render porcesses going at the same time.

A render process is an instance of Chromium so you can think of each render process as being a tab or a window in the browser.

we create one by initiating a browser window 
 

