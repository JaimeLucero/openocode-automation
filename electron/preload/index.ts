import { contextBridge, ipcRenderer } from 'electron';

type TerminalOutputCallback = (pane: string, output: string) => void;

const terminalOutputCallbacks: Record<string, TerminalOutputCallback> = {};

export interface Session {
  id: number;
  project_dir: string;
  project_name: string;
  planner_model: string;
  builder_model: string;
  tester_model: string;
  status: 'active' | 'completed' | 'aborted';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ElectronAPI {
  selectDirectory: () => Promise<string | null>;
  validateProjectMd: (path: string) => Promise<{ exists: boolean; content?: string }>;
  startAutomation: (config: {
    projectDir: string;
    plannerModel: string;
    builderModel: string;
    testerModel: string;
    opencodeKey?: string;
    telegramToken?: string;
    chatId?: string;
    projectMdContent?: string;
    mcpServers?: Array<{
      id: string;
      name: string;
      type: 'local' | 'remote';
      command?: string[];
      url?: string;
      headers?: Record<string, string>;
    }>;
  }) => Promise<{ success: boolean; error?: string }>;
  sendUserInput: (message: string) => Promise<{ success: boolean }>;
  pause: () => Promise<{ success: boolean }>;
  resume: () => Promise<{ success: boolean }>;
  stop: () => Promise<{ success: boolean; forced: boolean }>;
  forceStop: () => Promise<{ success: boolean }>;
  skip: () => Promise<{ success: boolean }>;
  getStatus: () => Promise<unknown>;
  configureTelegram: (config: { botToken: string; chatId: string }) => Promise<{ success: boolean }>;
  deleteSession: (sessionId: number) => Promise<{ success: boolean }>;
  sendTerminalInput: (pane: string, input: string) => void;
  resizeTerminal: (pane: string, cols: number, rows: number) => void;
  getSessions: () => Promise<Session[]>;
  setProjectDir: (projectDir: string) => Promise<{ success: boolean }>;
  onTerminalOutput: (callback: TerminalOutputCallback) => () => void;
  onProgress: (callback: (data: unknown) => void) => void;
  onTicketStatus: (callback: (data: unknown) => void) => void;
  onAgentStatus: (callback: (data: unknown) => void) => void;
  onInterventionNeeded: (callback: (data: { reason: string }) => void) => void;
  onAutomationComplete: (callback: () => void) => void;
  onError: (callback: (data: unknown) => void) => void;
}

const handleTerminalOutput = (_event: Electron.IpcRendererEvent, data: { pane: string; output: string }) => {
  Object.values(terminalOutputCallbacks).forEach((callback) => {
    callback(data.pane, data.output);
  });
};

ipcRenderer.on('terminal-output', handleTerminalOutput);

const api: ElectronAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  validateProjectMd: (path) => ipcRenderer.invoke('validate-project-md', path),
  startAutomation: (config) => ipcRenderer.invoke('start-automation', config),
  sendUserInput: (message) => ipcRenderer.invoke('user-input', message),
  pause: () => ipcRenderer.invoke('pause'),
  resume: () => ipcRenderer.invoke('resume'),
  stop: () => ipcRenderer.invoke('stop'),
  forceStop: () => ipcRenderer.invoke('force-stop'),
  skip: () => ipcRenderer.invoke('skip'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  configureTelegram: (config) => ipcRenderer.invoke('configure-telegram', config),
  deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
  sendTerminalInput: (pane, input) => ipcRenderer.send('terminal-input', pane, input),
  resizeTerminal: (pane, cols, rows) => ipcRenderer.send('resize-terminal', { pane, cols, rows }),
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  setProjectDir: (projectDir) => ipcRenderer.invoke('set-project-dir', projectDir),
  onTerminalOutput: (callback) => {
    const id = `cb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    terminalOutputCallbacks[id] = callback;
    return () => {
      delete terminalOutputCallbacks[id];
    };
  },
  onProgress: (callback) => ipcRenderer.on('progress', (_event, data) => callback(data)),
  onTicketStatus: (callback) => ipcRenderer.on('ticket-status', (_event, data) => callback(data)),
  onAgentStatus: (callback) => ipcRenderer.on('agent-status', (_event, data) => callback(data)),
  onInterventionNeeded: (callback) =>
    ipcRenderer.on('intervention-needed', (_event, data) => callback(data as { reason: string })),
  onAutomationComplete: (callback) => ipcRenderer.on('automation-complete', () => callback()),
  onError: (callback) => ipcRenderer.on('error', (_event, data) => callback(data)),
};

contextBridge.exposeInMainWorld('electron', api);
