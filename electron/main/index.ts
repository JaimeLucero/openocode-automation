import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import log from 'electron-log';
import { PythonBridge } from './python-bridge';
import { PtyManager } from './pty-manager';

log.initialize();
log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let ptyManager: PtyManager | null = null;
let currentProjectDir: string = '';

const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'OpenCode Orchestrator',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

function setupIpcHandlers(): void {
  ptyManager = new PtyManager();
  pythonBridge = new PythonBridge((event, data) => {
    mainWindow?.webContents.send(event, data);
  }, ptyManager, isDev);

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Directory',
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('validate-project-md', async (_event, projectPath: string) => {
    const projectMdPath = path.join(projectPath, 'PROJECT.md');
    try {
      if (fs.existsSync(projectMdPath)) {
        const content = fs.readFileSync(projectMdPath, 'utf-8');
        return { exists: true, content };
      }
      return { exists: false };
    } catch (error) {
      log.error('Error reading PROJECT.md:', error);
      return { exists: false };
    }
  });

  ipcMain.handle('start-automation', async (_event, config: {
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
  }) => {
    const status = pythonBridge?.getStatus();
    if (status?.running) {
      log.warn('Automation already running, ignoring start request');
      return { success: false, error: 'Automation already running' };
    }
    log.info('Starting automation:', config);
    currentProjectDir = config.projectDir;
    try {
      const userDataPath = isDev ? '' : app.getPath('userData');
      await pythonBridge?.start({ ...config, userDataPath });
      return { success: true };
    } catch (error) {
      log.error('Failed to start automation:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('set-project-dir', async (_event, projectDir: string) => {
    log.info('Setting project dir:', projectDir);
    currentProjectDir = projectDir;
    if (pythonBridge) {
      pythonBridge.setCurrentProjectDir(projectDir);
    }
    return { success: true };
  });

  ipcMain.handle('user-input', async (_event, message: string) => {
    log.info('User input:', message);
    await pythonBridge?.sendUserInput(message);
    return { success: true };
  });

  ipcMain.handle('pause', async () => {
    await pythonBridge?.pause();
    return { success: true };
  });

  ipcMain.handle('resume', async () => {
    await pythonBridge?.resume();
    return { success: true };
  });

  ipcMain.handle('stop', async () => {
    log.info('Stop requested - calling pythonBridge.stop()');
    const result = await pythonBridge?.stop();
    log.info('Stop completed:', result);
    return result || { success: true, forced: false };
  });

  ipcMain.handle('force-stop', async () => {
    log.info('Force stop requested');
    await pythonBridge?.forceKill();
    log.info('Force stop completed');
    return { success: true };
  });

  ipcMain.handle('skip', async () => {
    await pythonBridge?.skip();
    return { success: true };
  });

  ipcMain.handle('get-status', async () => {
    return pythonBridge?.getStatus() || null;
  });

  ipcMain.handle('configure-telegram', async (_event, config: {
    botToken: string;
    chatId: string;
  }) => {
    await pythonBridge?.configureTelegram(config);
    return { success: true };
  });

  ipcMain.on('terminal-input', (_event, pane: string, input: string) => {
    ptyManager?.sendInput(pane, input);
  });

  ipcMain.on('resize-terminal', (_event, data: { pane: string; cols: number; rows: number }) => {
    pythonBridge?.resizeTerminal(data.pane, data.cols, data.rows);
  });

  ipcMain.handle('get-sessions', async () => {
    return new Promise((resolve) => {
      const scriptPath = getSessionQueryScript();
      exec(`python3.12 "${scriptPath}" get-sessions`, (error, stdout, stderr) => {
        if (error) {
          log.error('Failed to get sessions:', error);
          resolve([]);
          return;
        }
        try {
          const result = JSON.parse(stdout);
          resolve(result.sessions || []);
        } catch {
          log.error('Failed to parse sessions:', stderr);
          resolve([]);
        }
      });
    });
  });
}

function getSessionQueryScript(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '../../../src/opencode_orchestrator/session_query.py');
  }
  const basePath = process.resourcesPath || path.join(__dirname, '..');
  return path.join(basePath, 'python/src/opencode_orchestrator/session_query.py');
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  pythonBridge?.stop();
  ptyManager?.cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  pythonBridge?.stop();
  ptyManager?.cleanup();
});
