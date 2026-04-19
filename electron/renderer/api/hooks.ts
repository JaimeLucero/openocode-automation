import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';

declare global {
  interface Window {
    api: {
      getSessions: () => Promise<Session[]>;
      getSession: (id: number) => Promise<Session>;
      deleteSession: (id: number) => Promise<{ success: boolean }>;
      getTickets: (id: number) => Promise<Ticket[]>;
      startAutomation: (config: AutomationConfig) => Promise<{ success: boolean; session_id?: number; message?: string }>;
      stopAutomation: () => Promise<{ success: boolean; message?: string }>;
      pauseAutomation: () => Promise<{ success: boolean; message?: string }>;
      resumeAutomation: () => Promise<{ success: boolean; message?: string }>;
      sendInput: (message: string) => Promise<{ success: boolean; message?: string }>;
      getStatus: () => Promise<Status>;
      onStatus: (callback: (data: unknown) => void) => void;
      offStatus: (callback: (data: unknown) => void) => void;
      onPhaseChanged: (callback: (data: unknown) => void) => void;
      offPhaseChanged: (callback: (data: unknown) => void) => void;
      onProgress: (callback: (data: unknown) => void) => void;
      offProgress: (callback: (data: unknown) => void) => void;
      onInterventionNeeded: (callback: (data: unknown) => void) => void;
      offInterventionNeeded: (callback: (data: unknown) => void) => void;
      onAutomationStopped: (callback: (data: unknown) => void) => void;
      offAutomationStopped: (callback: (data: unknown) => void) => void;
    };
  }
}

interface Session {
  id: number;
  project_dir: string;
  project_name: string;
  phase: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface Ticket {
  id: number;
  session_id: number;
  ticket_id: number;
  title: string;
  file_path: string;
  dependencies: unknown[];
  steps: unknown[];
  status: string;
  retries: number;
  max_retries: number;
  error: string;
}

interface Status {
  session_id: number;
  running: boolean;
  paused: boolean;
  phase: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    currentTicket?: string;
  };
}

interface AutomationConfig {
  projectDir: string;
  projectContext: string;
  plannerModel: string;
  builderModel: string;
  testerModel: string;
}

// ─────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────

export const queryKeys = {
  sessions: ['sessions'] as const,
  session: (id: number) => ['sessions', id] as const,
  tickets: (sessionId: number) => ['tickets', sessionId] as const,
  status: ['status'] as const,
};

export const useSessions = () => {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: () => window.api.getSessions(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Poll every 30s as fallback
  });
};

export const useSession = (sessionId: number) => {
  return useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: () => window.api.getSession(sessionId),
    enabled: !!sessionId,
  });
};

export const useTickets = (sessionId: number) => {
  return useQuery({
    queryKey: queryKeys.tickets(sessionId),
    queryFn: () => window.api.getTickets(sessionId),
    enabled: !!sessionId,
  });
};

export const useStatus = () => {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: () => window.api.getStatus(),
    staleTime: 1000, // 1 second
    refetchInterval: 5000, // Poll every 5s as WebSocket fallback
  });
};

export const useStartAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AutomationConfig) => window.api.startAutomation(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
};

export const useStopAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.api.stopAutomation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
};

export const usePauseAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.api.pauseAutomation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
};

export const useResumeAutomation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => window.api.resumeAutomation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
};

export const useSendInput = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => window.api.sendInput(message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => window.api.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
};

// ─────────────────────────────────────────────────────────────
// Real-time Subscriptions via IPC Events
// ─────────────────────────────────────────────────────────────

export function useStatusSubscription(callback: (status: Status) => void) {
  const handler = useCallback((data: unknown) => {
    callback(data as Status);
  }, [callback]);

  useEffect(() => {
    window.api.onStatus(handler);
    return () => window.api.offStatus(handler);
  }, [handler]);
}

export function usePhaseSubscription(callback: (phase: string) => void) {
  const handler = useCallback((data: unknown) => {
    const message = data as { phase: string };
    callback(message.phase);
  }, [callback]);

  useEffect(() => {
    window.api.onPhaseChanged(handler);
    return () => window.api.offPhaseChanged(handler);
  }, [handler]);
}

export function useProgressSubscription(callback: (progress: Status['progress']) => void) {
  const handler = useCallback((data: unknown) => {
    callback(data as Status['progress']);
  }, [callback]);

  useEffect(() => {
    window.api.onProgress(handler);
    return () => window.api.offProgress(handler);
  }, [handler]);
}

export function useInterventionSubscription(callback: (data: unknown) => void) {
  useEffect(() => {
    window.api.onInterventionNeeded(callback);
    return () => window.api.offInterventionNeeded(callback);
  }, [callback]);
}

export function useAutomationStoppedSubscription(callback: () => void) {
  useEffect(() => {
    window.api.onAutomationStopped(callback);
    return () => window.api.offAutomationStopped(callback);
  }, [callback]);
}