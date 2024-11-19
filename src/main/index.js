// index.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sites = require('./config/sites');
const BrowserManager = require('./core/browser');
const StoreManager = require('./core/store');
const setupHandlers = require('./handlers');

let mainWindow;
const browserManager = new BrowserManager();
const storeManager = new StoreManager();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
    createWindow();
    
    const handlers = setupHandlers(browserManager, storeManager, sites, mainWindow);
    
    // IPC 핸들러 등록
    Object.entries(handlers).forEach(([channel, handler]) => {
        ipcMain.handle(channel, (event, ...args) => handler(...args));
    });
});

app.on('window-all-closed', () => {
    browserManager.closeAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});