import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  pane: string;
  title: string;
}

export function TerminalPane({ pane, title }: TerminalPaneProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 10000,
      disableStdin: true,
      convertEol: true,
      allowProposedApi: true,
    });

    const unicode11Addon = new Unicode11Addon();
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = '11';

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    xtermRef.current = terminal;

    const cleanup = window.electron.onTerminalOutput((outputPane, output) => {
      if (outputPane === pane) {
        terminal.write(output);
      }
    });

    const fitTerminal = () => {
      try {
        if (terminal.cols > 0 && terminal.rows > 0) {
          fitAddon.fit();
          window.electron.resizeTerminal(pane, terminal.cols, terminal.rows);
        }
      } catch {
        // Ignore fit errors during initialization
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fitTerminal();
      });
    });

    // Also resize immediately on mount in case automation is already running
    setTimeout(() => fitTerminal(), 100);
    setTimeout(() => fitTerminal(), 500);

    const handleResize = () => {
      requestAnimationFrame(() => {
        fitTerminal();
        window.electron.resizeTerminal(pane, terminal.cols, terminal.rows);
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanup();
      terminal.dispose();
    };
  }, [pane]);

  return (
    <div className="terminal-pane">
      <div className="terminal-header">
        <span className="terminal-title">{title}</span>
        <span className="terminal-badge">{pane}</span>
      </div>
      <div className="terminal-content">
        <div ref={terminalRef} className="xterm-container" />
      </div>
    </div>
  );
}

export function TerminalGrid() {
  return (
    <div className="terminal-grid">
      <TerminalPane pane="planner" title="Planner Agent" />
      <TerminalPane pane="builder" title="Builder Agent" />
      <TerminalPane pane="tester" title="Tester Agent" />
    </div>
  );
}
