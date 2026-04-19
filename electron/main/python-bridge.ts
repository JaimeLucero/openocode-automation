import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import log from 'electron-log';
import { PtyManager } from './pty-manager';

interface MCPServerConfig {
  id: string;
  name: string;
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  headers?: Record<string, string>;
}

interface AutomationConfig {
  projectDir: string;
  plannerModel: string;
  builderModel: string;
  testerModel: string;
  opencodeKey?: string;
  telegramToken?: string;
  chatId?: string;
  projectMdContent?: string;
  mcpServers?: MCPServerConfig[];
  userDataPath?: string;
}

interface Status {
  running: boolean;
  phase: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  currentTicket?: string;
}

type IpcSender = (event: string, data: unknown) => void;

export class PythonBridge {
  private process: ChildProcess | null = null;
  private sendIpc: IpcSender;
  private ptyManager: PtyManager;
  private isDev: boolean;
  private status: Status = {
    running: false,
    phase: 'idle',
    progress: { total: 0, completed: 0, failed: 0, pending: 0 },
  };
  private currentProjectDir: string = '';

  constructor(sendIpc: IpcSender, ptyManager: PtyManager, isDev: boolean = false) {
    this.sendIpc = sendIpc;
    this.ptyManager = ptyManager;
    this.isDev = isDev;
  }

  getProcess(): ChildProcess | null {
    return this.process;
  }

  getCurrentProjectDir(): string {
    return this.currentProjectDir;
  }

  setCurrentProjectDir(dir: string): void {
    this.currentProjectDir = dir;
  }

  isProcessAlive(): boolean {
    if (!this.process) return false;
    if (this.process.exitCode !== null) return false;
    if (this.process.stdin?.destroyed) return false;
    return true;
  }

  async start(config: AutomationConfig): Promise<void> {
    if (this.process) {
      await this.forceKill();
    }

    this.currentProjectDir = config.projectDir;
    const pythonPath = this.getPythonPath();
    const scriptPath = this.getOrchestratorScript();

    log.info('Starting Python process:', pythonPath, scriptPath);

    const initData = JSON.stringify({
      action: 'init',
      config: {
        project_dir: config.projectDir,
        planner_model: config.plannerModel,
        builder_model: config.builderModel,
        tester_model: config.testerModel,
        opencode_key: config.opencodeKey || '',
        telegram_token: config.telegramToken,
        chat_id: config.chatId,
        project_md_content: config.projectMdContent || '',
        mcp_servers: config.mcpServers || [],
      },
    });

    const userDataPath = config.userDataPath || process.env.OPENCODE_USER_DATA || '';

    this.process = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENCODE_ORCHESTRATOR_INIT: initData,
        ...(userDataPath ? { OPENCODE_USER_DATA: userDataPath } : {}),
      },
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handlePythonOutput(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      log.error('Python stderr:', data.toString());
    });

    this.process.on('error', (err) => {
      log.error('Python process error:', err.message);
      this.status.running = false;
    });

    this.process.on('close', (code, signal) => {
      log.info(`Python process closed: code=${code}, signal=${signal}`);
      this.status.running = false;
      this.sendIpc('automation-complete', { code, signal });
    });

    this.status.running = true;
    log.info('Python process started successfully');
  }

  private handlePythonOutput(output: string): void {
    const lines = output.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch {
        this.sendIpc('terminal-output', { pane: 'system', output: line });
      }
    }
  }

  private handleMessage(message: {
    type: string;
    pane?: string;
    output?: string;
    event?: string;
    data?: unknown;
  }): void {
    switch (message.type) {
      case 'terminal-output':
        this.sendIpc('terminal-output', {
          pane: message.pane,
          output: message.output,
        });
        break;
      case 'progress':
        this.status.progress = message.data as typeof this.status.progress;
        this.sendIpc('progress', message.data);
        break;
      case 'ticket-status':
        this.sendIpc('ticket-status', message.data);
        break;
      case 'agent-status':
        this.sendIpc('agent-status', message.data);
        break;
      case 'intervention-needed':
        this.sendIpc('intervention-needed', message.data);
        break;
      case 'automation-complete':
        this.status.running = false;
        this.sendIpc('automation-complete', {});
        break;
      case 'error':
        log.error('Python error:', message.data);
        this.sendIpc('error', message.data);
        break;
      default:
        this.sendIpc('message', message);
    }
  }

  async sendUserInput(message: string): Promise<void> {
    this.sendToPython({ type: 'user-input', message });
  }

  async pause(): Promise<void> {
    this.sendToPython({ type: 'pause' });
  }

  async resume(): Promise<void> {
    this.sendToPython({ type: 'resume' });
  }

  async stop(): Promise<{ success: boolean; forced: boolean }> {
    log.info('python-bridge.stop() called');

    if (!this.isProcessAlive()) {
      log.info('Process already dead, forcing stop');
      this.forceKill();
      this.updateSessionStatus('aborted');
      return { success: true, forced: true };
    }

    log.info('Sending stop message to Python...');
    this.sendToPython({ type: 'stop' });

    // Wait up to 2 seconds for Python to respond
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (this.process) {
      log.info('Process did not stop gracefully, killing...');
      try {
        this.process.kill('SIGTERM');
      } catch (e) {
        log.error('Error killing process:', e);
      }
      this.process = null;
    }

    this.status.running = false;
    this.ptyManager.cleanup();
    this.updateSessionStatus('aborted');

    log.info('Stop completed');
    return { success: true, forced: true };
  }

  async forceKill(): Promise<void> {
    log.info('forceKill() called');

    if (this.process) {
      try {
        this.process.kill('SIGKILL');
      } catch (e) {
        log.error('Error force killing process:', e);
      }
      this.process = null;
    }

    this.status.running = false;
    this.ptyManager.cleanup();
    this.updateSessionStatus('aborted');

    log.info('Force kill completed');
  }

  async skip(): Promise<void> {
    this.sendToPython({ type: 'skip' });
  }

  async configureTelegram(config: { botToken: string; chatId: string }): Promise<void> {
    this.sendToPython({ type: 'configure-telegram', config });
  }

  resizeTerminal(pane: string, cols: number, rows: number): void {
    this.sendToPython({ type: 'resize-terminal', pane, cols, rows });
  }

  getStatus(): Status {
    return { ...this.status };
  }

  private sendToPython(message: Record<string, unknown>): void {
    if (this.process?.stdin && !this.process.stdin.destroyed) {
      const data = JSON.stringify(message) + '\n';
      log.info('Sending to Python:', (message as { type: string }).type);
      try {
        this.process.stdin.write(data);
        log.info('Write completed to Python stdin');
      } catch (e) {
        log.error('Error writing to Python stdin:', e);
      }
    } else {
      log.warn('Cannot send to Python: stdin not available or destroyed');
    }
  }

  private updateSessionStatus(status: string): void {
    const projectDir = this.currentProjectDir;
    if (!projectDir) {
      log.info('No project dir set, skipping session status update');
      return;
    }

    log.info('Updating session status:', projectDir, status);

    try {
      const scriptPath = this.getSessionQueryScript();
      const pythonPath = this.getPythonPath();
      const result = execSync(
        `${pythonPath} "${scriptPath}" update-status "${projectDir}" "${status}"`,
        { encoding: 'utf-8' }
      );
      log.info('Session status update result:', result);
    } catch (e) {
      log.error('Failed to update session status:', e);
    }
  }

  private getPythonPath(): string {
    if (process.platform === 'win32') {
      return 'python';
    }
    return 'python3.12';
  }

  private getOrchestratorScript(): string {
    if (this.isDev) {
      return path.join(__dirname, '../../../src/opencode_orchestrator/electron_service.py');
    }
    const basePath = process.resourcesPath || path.join(__dirname, '..');
    return path.join(basePath, 'python/src/opencode_orchestrator/electron_service.py');
  }

  private getSessionQueryScript(): string {
    if (this.isDev) {
      return path.join(__dirname, '../../../src/opencode_orchestrator/session_query.py');
    }
    const basePath = process.resourcesPath || path.join(__dirname, '..');
    return path.join(basePath, 'python/src/opencode_orchestrator/session_query.py');
  }
}
