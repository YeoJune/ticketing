// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getSites: () => ipcRenderer.invoke('get-sites'),
    getAccounts: (siteId) => ipcRenderer.invoke('get-accounts', siteId),
    saveAccount: (siteId, account) => ipcRenderer.invoke('save-account', siteId, account),
    removeAccount: (siteId, index) => ipcRenderer.invoke('remove-account', siteId, index),
    startExecution: (data) => ipcRenderer.invoke('start-execution', data),
    closeBrowsers: () => ipcRenderer.invoke('close-browsers'),
    scheduleTicketing: (data) => ipcRenderer.invoke('schedule-ticketing', data),
});