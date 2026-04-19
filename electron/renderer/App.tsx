import React, { useState, useCallback, useEffect } from 'react';
import { Onboarding } from './components/Onboarding';
import { TerminalGrid } from './components/TerminalPane';
import { UserInput } from './components/UserInput';
import { ControlBar } from './components/ControlBar';
import { Progress } from './components/Progress';
import { InterventionModal, InterventionData } from './components/InterventionModal';
import { SessionSelect, Session } from './components/SessionSelect';

interface MCPServer {
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
  mcpServers?: MCPServer[];
}

interface ProgressData {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

type View = 'sessions' | 'onboarding' | 'automation';

declare global {
  interface Window {
    electron: {
      selectDirectory: () => Promise<string | null>;
      validateProjectMd: (projectPath: string) => Promise<{ exists: boolean; content?: string }>;
      startAutomation: (config: AutomationConfig) => Promise<{ success: boolean; error?: string }>;
      sendUserInput: (message: string) => Promise<{ success: boolean }>;
      pause: () => Promise<{ success: boolean }>;
      resume: () => Promise<{ success: boolean }>;
      stop: () => Promise<{ success: boolean; forced: boolean }>;
      forceStop: () => Promise<{ success: boolean }>;
      skip: () => Promise<{ success: boolean }>;
      getStatus: () => Promise<unknown>;
      configureTelegram: (config: { botToken: string; chatId: string }) => Promise<{ success: boolean }>;
      sendTerminalInput: (pane: string, input: string) => void;
      resizeTerminal: (pane: string, cols: number, rows: number) => void;
getSessions: () => Promise<Session[]>;
  setProjectDir: (projectDir: string) => Promise<{ success: boolean }>;
  onTerminalOutput: (callback: (pane: string, output: string) => void) => () => void;
      onProgress: (callback: (data: ProgressData) => void) => void;
      onTicketStatus: (callback: (data: unknown) => void) => void;
      onAgentStatus: (callback: (data: unknown) => void) => void;
      onInterventionNeeded: (callback: (data: InterventionData) => void) => void;
      onAutomationComplete: (callback: () => void) => void;
      onError: (callback: (data: unknown) => void) => void;
    };
  }
}

export default function App() {
  const [view, setView] = useState<View>('sessions');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState<ProgressData>({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
  });
  const [config, setConfig] = useState<AutomationConfig | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [intervention, setIntervention] = useState<InterventionData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const sessionList = await window.electron.getSessions();
      setSessions(sessionList);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleNewAutomation = useCallback(() => {
    setStartError(null);
    setView('onboarding');
  }, []);

  const handleSelectSession = useCallback(async (session: Session) => {
    if (session.status === 'active') {
      setConfig({
        projectDir: session.project_dir,
        plannerModel: session.planner_model || 'kimi-k2.5',
        builderModel: session.builder_model || 'kimi-k2.5',
        testerModel: session.tester_model || 'kimi-k2.5',
      });
      await window.electron.setProjectDir(session.project_dir);
      setView('automation');
      setIsRunning(true);
      return;
    }

    if (session.status === 'completed') {
      alert('This session has already completed. Please start a new automation.');
      return;
    }

    if (session.status === 'aborted') {
      const confirmed = confirm('This session was aborted. Would you like to restart automation?');
      if (!confirmed) return;
    }

    setStartError(null);
    setConfig({
      projectDir: session.project_dir,
      plannerModel: session.planner_model || 'kimi-k2.5',
      builderModel: session.builder_model || 'kimi-k2.5',
      testerModel: session.tester_model || 'kimi-k2.5',
    });

    setView('automation');
    setIsRunning(true);

    const result = await window.electron.startAutomation({
      projectDir: session.project_dir,
      plannerModel: session.planner_model || 'kimi-k2.5',
      builderModel: session.builder_model || 'kimi-k2.5',
      testerModel: session.tester_model || 'kimi-k2.5',
    });

    if (!result.success) {
      setStartError(result.error || 'Failed to resume session');
      setView('sessions');
      setIsRunning(false);
    }
  }, []);

  const handleStart = useCallback(async (cfg: AutomationConfig) => {
    setStartError(null);
    setConfig(cfg);
    const result = await window.electron.startAutomation(cfg);
    if (result.success) {
      setView('automation');
      setIsRunning(true);
    } else {
      const errorMsg = result.error || 'Unknown error';
      if (errorMsg.includes('model') || errorMsg.includes('access') || errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
        setStartError(`Model access error: ${errorMsg}. Please check your API key or select a different model.`);
      } else {
        setStartError('Failed to start automation: ' + errorMsg);
      }
    }
  }, []);

  const handlePause = useCallback(async () => {
    await window.electron.pause();
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(async () => {
    await window.electron.resume();
    setIsPaused(false);
  }, []);

  const handleStop = useCallback(async () => {
    await window.electron.stop();
    setIsRunning(false);
  }, []);

  const handleForceStop = useCallback(async () => {
    await window.electron.forceStop();
    setIsRunning(false);
    setIsPaused(false);
    setConfig(null);
    setProgress({ total: 0, completed: 0, failed: 0, pending: 0 });
    setIntervention(null);
    await loadSessions();
    setView('sessions');
  }, []);

  const handleHome = useCallback(async () => {
    if (isRunning) {
      await window.electron.stop();
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsRunning(false);
    setIsPaused(false);
    setConfig(null);
    setProgress({ total: 0, completed: 0, failed: 0, pending: 0 });
    setIntervention(null);
    await loadSessions();
    setView('sessions');
  }, [isRunning]);

  const handleSkip = useCallback(async () => {
    await window.electron.skip();
  }, []);

  const handleUserInput = useCallback(async (message: string) => {
    await window.electron.sendUserInput(message);
  }, []);

  const handleInterventionResume = useCallback(async (fix?: string) => {
    if (fix) {
      await window.electron.sendUserInput(fix);
    }
    await window.electron.resume();
    setIntervention(null);
  }, []);

  const handleInterventionSkip = useCallback(async () => {
    await window.electron.skip();
    setIntervention(null);
  }, []);

  const handleInterventionAbort = useCallback(async () => {
    await window.electron.stop();
    setIntervention(null);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    window.electron.onProgress((data) => {
      setProgress(data);
    });

    window.electron.onAutomationComplete(() => {
      setIsRunning(false);
      loadSessions();
    });

    window.electron.onInterventionNeeded((data: InterventionData) => {
      setIntervention(data);
    });
  }, []);

  if (view === 'sessions') {
    const hasActiveSession = sessions.some(s => s.status === 'active');
    return <SessionSelect
      sessions={sessions}
      onNewAutomation={handleNewAutomation}
      onSelectSession={handleSelectSession}
      onDeleted={loadSessions}
      hasActiveSession={hasActiveSession}
    />;
  }

  if (view === 'onboarding') {
    return <Onboarding onStart={handleStart} error={startError} onClearError={() => setStartError(null)} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>OpenCode Orchestrator</h1>
        <span className="project-name">{config?.projectDir.split('/').pop()}</span>
      </header>

      <TerminalGrid />

      <UserInput onSubmit={handleUserInput} disabled={!isRunning || isPaused} />

      <ControlBar
        isRunning={isRunning}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onForceStop={handleForceStop}
        onSkip={handleSkip}
        onHome={handleHome}
      />

      <Progress data={progress} />

      {intervention && (
        <InterventionModal
          data={intervention}
          onResume={handleInterventionResume}
          onSkip={handleInterventionSkip}
          onAbort={handleInterventionAbort}
          onSendFix={handleInterventionResume}
        />
      )}
    </div>
  );
}
