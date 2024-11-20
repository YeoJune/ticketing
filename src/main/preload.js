
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // 기존 API 유지
    getSites: () => ipcRenderer.invoke('get-sites'),
    getAccounts: (siteId) => ipcRenderer.invoke('get-accounts', siteId),
    saveAccount: (siteId, account) => ipcRenderer.invoke('save-account', siteId, account),
    removeAccount: (siteId, index) => ipcRenderer.invoke('remove-account', siteId, index),
    startExecution: (data) => ipcRenderer.invoke('start-execution', data),
    returnToMain: () => ipcRenderer.invoke('return-to-main'),
    closeBrowsers: () => ipcRenderer.invoke('close-browsers'),
    scheduleTicketing: (data) => ipcRenderer.invoke('schedule-ticketing', data),

    // 취소 티켓팅 API 추가
    startCancelTicketing: (data) => ipcRenderer.invoke('start-cancel-ticketing', data),
    stopCancelTicketing: () => ipcRenderer.invoke('stop-cancel-ticketing'),
    
    // 취소 티켓팅 상태 리스너
    onCancelTicketingStatus: (callback) => {
        ipcRenderer.on('cancel-ticketing-status', (event, data) => callback(data));
    },
    onCancelTicketingStopped: (callback) => {
        ipcRenderer.on('cancel-ticketing-stopped', () => callback());
    }
});