"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
    startAutomation: (config) => electron_1.ipcRenderer.invoke('start-automation', config),
    sendUserInput: (message) => electron_1.ipcRenderer.invoke('user-input', message),
    pause: () => electron_1.ipcRenderer.invoke('pause'),
    resume: () => electron_1.ipcRenderer.invoke('resume'),
    stop: () => electron_1.ipcRenderer.invoke('stop'),
    skip: () => electron_1.ipcRenderer.invoke('skip'),
    getStatus: () => electron_1.ipcRenderer.invoke('get-status'),
    configureTelegram: (config) => electron_1.ipcRenderer.invoke('configure-telegram', config),
    sendTerminalInput: (pane, input) => electron_1.ipcRenderer.send('terminal-input', pane, input),
    onTerminalOutput: (callback) => electron_1.ipcRenderer.on('terminal-output', (_event, data) => callback(data)),
    onProgress: (callback) => electron_1.ipcRenderer.on('progress', (_event, data) => callback(data)),
    onTicketStatus: (callback) => electron_1.ipcRenderer.on('ticket-status', (_event, data) => callback(data)),
    onAgentStatus: (callback) => electron_1.ipcRenderer.on('agent-status', (_event, data) => callback(data)),
    onInterventionNeeded: (callback) => electron_1.ipcRenderer.on('intervention-needed', (_event, data) => callback(data)),
    onAutomationComplete: (callback) => electron_1.ipcRenderer.on('automation-complete', () => callback()),
    onError: (callback) => electron_1.ipcRenderer.on('error', (_event, data) => callback(data)),
};
electron_1.contextBridge.exposeInMainWorld('electron', api);
