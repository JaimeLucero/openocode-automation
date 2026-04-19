import log from 'electron-log';

interface AutomationConfig {
  projectDir: string;
  projectContext: string;
  plannerModel: string;
  builderModel: string;
  testerModel: string;
  telegramToken?: string;
  telegramChatId?: string;
}

interface Status {
  running: boolean;
  paused: boolean;
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

export class ApiClient {
  private baseUrl: string;
  private sendIpc: IpcSender;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(sendIpc: IpcSender, baseUrl: string = 'http://localhost:8000') {
    this.sendIpc = sendIpc;
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      return response.json() as Promise<T>;
    } catch (err) {
      log.error(`API request failed: ${method} ${path}`, err);
      throw err;
    }
  }

  async startAutomation(config: AutomationConfig): Promise<{ success: boolean; session_id?: number; message?: string }> {
    return this.request('POST', '/api/v1/automation/start', {
      project_dir: config.projectDir,
      project_context: config.projectContext,
      planner_model: config.plannerModel,
      builder_model: config.builderModel,
      tester_model: config.testerModel,
    });
  }

  async stopAutomation(): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/stop');
  }

  async forceStopAutomation(): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/force-stop');
  }

  async pauseAutomation(): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/pause');
  }

  async resumeAutomation(): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/resume');
  }

  async getStatus(): Promise<Status> {
    return this.request('GET', '/api/v1/automation/status');
  }

  async sendInput(message: string): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/input', { message });
  }

  async plannerComplete(output: string): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/planner-complete', { output });
  }

  async builderComplete(success: boolean = true): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/builder-complete', { success });
  }

  async testerComplete(passed: boolean = true, error?: string): Promise<{ success: boolean; message?: string }> {
    return this.request('POST', '/api/v1/automation/tester-complete', { passed, error });
  }

  async connectWebSocket(): Promise<void> {
    log.info('WebSocket connection skipped in Electron main');
  }

  async _connectWebSocketOld(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/api/v1/automation/ws';

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          log.info('WebSocket connected');
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data.toString());
            this.handleWsMessage(data);
          } catch (err) {
            log.error('Failed to parse WebSocket message', err);
          }
        };

        this.ws.onclose = () => {
          log.info('WebSocket disconnected');
          this.ws = null;
          this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
          log.error('WebSocket error', err);
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleWsMessage(data: unknown): void {
    const message = data as { type: string; [key: string]: unknown };

    switch (message.type) {
      case 'terminal-output':
        this.sendIpc('terminal-output', { pane: message.pane, output: message.output });
        break;
      case 'agent-output':
        this.sendIpc('terminal-output', { pane: message.agentType, output: message.output });
        break;
      case 'phase-changed':
        this.sendIpc('phase-changed', { phase: message.phase });
        break;
      case 'progress':
        this.sendIpc('progress', message);
        break;
      case 'ticket-status':
        this.sendIpc('ticket-status', message);
        break;
      case 'agent-status':
        this.sendIpc('agent-status', message);
        break;
      case 'intervention-needed':
        this.sendIpc('intervention-needed', message);
        break;
      case 'automation-stopped':
      case 'automation-paused':
      case 'automation-resumed':
        this.sendIpc(message.type, message);
        break;
      default:
        log.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket().catch((err) => {
        log.error('WebSocket reconnect failed', err);
      });
    }, 5000);
  }

  disconnectWebSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}