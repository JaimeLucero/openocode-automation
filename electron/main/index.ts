import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';
import { ApiClient, SpawnAgentMsg, AgentCommandMsg } from './api-client';
import { PtyManager } from './pty-manager';

log.initialize();
log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;
let apiClient: ApiClient | null = null;
let ptyManager: PtyManager | null = null;
let currentProjectDir: string = '';
let apiClientStarted = false;

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

function setupApiClient(): void {
  if (apiClientStarted) return;
  
  const sendIpc = (event: string, data: unknown) => {
    mainWindow?.webContents.send(event, data);
  };
  
  apiClient = new ApiClient(sendIpc, 'http://localhost:8000');
  apiClientStarted = true;
  
  log.info('ApiClient initialized connecting to FastAPI');
  
  apiClient.connectWebSocket().then(() => {
    log.info('WebSocket connected');
  }).catch((err) => {
    log.error('WebSocket connection failed:', err);
  });
}

function findOpenCode(): string {
  try {
    const { execSync } = require('child_process');
    const result = execSync('which opencode', { encoding: 'utf8' }).trim();
    if (result) return result;
  } catch {}
  return '/opt/homebrew/bin/opencode';
}

const SKILLS: Record<string, string> = {
  planner: 'npx @smithery/cli@latest skill add shubhamsaboo/project-planner',
  builder: 'npx @smithery/cli@latest skill add jarredkenny/frontend-design && npx @smithery/cli@latest skill add skillcreatorai/backend-development',
  tester: 'npx @smithery/cli@latest skill add comet-ml/playwright-e2e',
};

function getAgentPrompt(agentType: string): string {
  const prompts: Record<string, string> = {
    planner: `Create tickets for this project. Format:
#1
**Title:** <title>
**File path:** 
**Dependencies:** <#1,#2 or ->
**Implementation steps:**
1. step one
2. step two

#2
... OUTPUT DONE`,
    builder: 'You are a code implementation expert. Implement tasks according to the tickets. Write code directly to files. Run tests to verify. Output DONE when complete.',
    tester: 'You are a testing expert. Run tests to verify implementation. Report pass/fail status. Output DONE when complete.',
  };
  return prompts[agentType] || 'Execute the given task.';
}

function spawnOpenCodeAgent(agentType: string, model: string, projectDir: string, prompt: string, onOutput: (output: string) => void) {
  const opencodePath = findOpenCode();
  const fullModel = model.includes('/') ? model : `opencode/${model}`;
  
  // For builder and tester, prompt comes via agent-command from backend
  // For planner, we pass the prompt directly via CLI
  const cliPrompt = agentType === 'planner' ? prompt : '';
  
  log.info(`Spawning ${agentType} with model ${fullModel}, prompt: ${cliPrompt ? cliPrompt.substring(0, 50) + '...' : '(from backend)'}`);
  
  ptyManager?.spawn(
    agentType,
    opencodePath,
    ['run', cliPrompt, '-m', fullModel],
    projectDir,
    (output) => {
      onOutput(output);
      mainWindow?.webContents.send('terminal-output', { pane: agentType, output });
    },
    (exitCode, fullOutput) => {
      log.info(`PTY ${agentType} exited with code ${exitCode}, output length: ${fullOutput.length}`);
      if (exitCode === 0) {
        log.info(`${agentType} completed successfully, signaling backend`);
        setTimeout(async () => {
          try {
            if (agentType === 'planner') {
              await apiClient?.plannerComplete(fullOutput);
            } else if (agentType === 'builder') {
              await apiClient?.builderComplete(true);
            } else if (agentType === 'tester') {
              await apiClient?.testerComplete(true);
            }
          } catch (err) {
            log.error(`Error signaling ${agentType} completion:`, err);
          }
        }, 500);
      }
    }
  );
}

function setupIpcHandlers(): void {
  ptyManager = new PtyManager();

  apiClient?.on('spawn-agent', (data) => {
    const msg = data as SpawnAgentMsg;
    log.info('Received spawn-agent:', msg);
    const prompt = getAgentPrompt(msg.agentType);
    spawnOpenCodeAgent(msg.agentType, msg.model, msg.projectDir, prompt, (output) => {
      apiClient?.sendMessage({ type: 'agent-output', agentType: msg.agentType, output });
    });
  });

  // Handle agent commands from backend (builder/tester phases after planner)
  apiClient?.on('agent-command', (data) => {
    const msg = data as AgentCommandMsg;
    log.info(`Sending command to ${msg.agentType}:`, msg.command);
    ptyManager?.sendInput(msg.agentType, msg.command + '\n');
  });

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
    try {
      log.info('Starting automation:', config);
      currentProjectDir = config.projectDir;
      const result = await apiClient?.startAutomation({
        projectDir: config.projectDir,
        projectContext: config.projectMdContent || '',
        plannerModel: config.plannerModel,
        builderModel: config.builderModel,
        testerModel: config.testerModel,
      });
      return { success: true, ...result };
    } catch (error) {
      log.error('Failed to start automation:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('set-project-dir', async (_event, projectDir: string) => {
    log.info('Setting project dir:', projectDir);
    currentProjectDir = projectDir;
    return { success: true };
  });

  ipcMain.handle('user-input', async (_event, message: string) => {
    log.info('User input:', message);
    return await apiClient?.sendInput(message);
  });

  ipcMain.handle('pause', async () => {
    return await apiClient?.pauseAutomation();
  });

  ipcMain.handle('resume', async () => {
    return await apiClient?.resumeAutomation();
  });

  ipcMain.handle('stop', async () => {
    log.info('Stop requested');
    const result = await apiClient?.stopAutomation();
    ptyManager?.cleanup();
    return result || { success: true };
  });

  ipcMain.handle('force-stop', async () => {
    log.info('Force stop requested');
    ptyManager?.cleanup();
    return await apiClient?.forceStopAutomation();
  });

  ipcMain.handle('skip', async () => {
    return { success: true };
  });

  ipcMain.handle('get-status', async () => {
    return await apiClient?.getStatus();
  });

  ipcMain.handle('configure-telegram', async (_event, config: {
    botToken: string;
    chatId: string;
  }) => {
    return { success: true };
  });

  ipcMain.on('terminal-input', (_event, pane: string, input: string) => {
    ptyManager?.sendInput(pane, input);
  });

  ipcMain.on('resize-terminal', (_event, data: { pane: string; cols: number; rows: number }) => {
    ptyManager?.resize(data.pane, data.cols, data.rows);
  });

  ipcMain.handle('get-sessions', async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/sessions');
      const data = await response.json() as { sessions?: Array<unknown> };
      return data.sessions || [];
    } catch (error) {
      log.error('Failed to get sessions:', error);
      return [];
    }
  });

  ipcMain.handle('delete-session', async (_event, sessionId: number) => {
    log.info('Delete session requested:', sessionId);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      log.info('Delete response:', response.status, response.ok);
      return { success: response.ok };
    } catch (error) {
      log.error('Failed to delete session:', error);
      return { success: false, error: String(error) };
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupApiClient();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  ptyManager?.cleanup();
  apiClient?.disconnectWebSocket();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  ptyManager?.cleanup();
  apiClient?.disconnectWebSocket();
});