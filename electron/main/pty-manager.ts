import * as pty from 'node-pty';
import log from 'electron-log';

export class PtyManager {
  private terminals: Map<string, pty.IPty> = new Map();
  private outputs: Map<string, string> = new Map();

  spawn(
    pane: string,
    command: string,
    args: string[],
    cwd: string,
    onData: (data: string) => void,
    onExit?: (exitCode: number, fullOutput: string) => void
  ): void {
    if (this.terminals.has(pane)) {
      this.terminals.get(pane)?.kill();
    }
    
    this.outputs.set(pane, '');

    log.info(`Spawning PTY for ${pane}:`, command, args, cwd);

    const terminal = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd,
      env: process.env as { [key: string]: string },
    });

    terminal.onData((data) => {
      const current = this.outputs.get(pane) || '';
      this.outputs.set(pane, current + data);
      onData(data);
    });
    terminal.onExit(({ exitCode }) => {
      log.info(`PTY ${pane} exited with code:`, exitCode);
      const fullOutput = this.outputs.get(pane) || '';
      if (onExit) {
        onExit(exitCode, fullOutput);
      }
      this.terminals.delete(pane);
      this.outputs.delete(pane);
    });

    this.terminals.set(pane, terminal);
    log.info(`PTY spawned for ${pane}`);
  }

  sendInput(pane: string, input: string): void {
    const terminal = this.terminals.get(pane);
    if (terminal) {
      terminal.write(input);
    }
  }

  resize(pane: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(pane);
    if (terminal) {
      terminal.resize(cols, rows);
    }
  }

  cleanup(): void {
    for (const [name, terminal] of this.terminals) {
      log.info(`Killing PTY ${name}`);
      terminal.kill();
    }
    this.terminals.clear();
  }
}
