import { Plus, Calendar, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteSession } from '@/api/hooks';

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

interface SessionSelectProps {
  sessions: Session[];
  onNewAutomation: () => void;
  onSelectSession: (session: Session) => void;
  onDeleted?: () => void;
  hasActiveSession: boolean;
}

export function SessionSelect({ sessions, onNewAutomation, onSelectSession, onDeleted, hasActiveSession }: SessionSelectProps) {
  const deleteSession = useDeleteSession();
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusVariant = (status: Session['status']): "success" | "default" | "destructive" => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'default';
      case 'aborted': return 'destructive';
      default: return 'default';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-8">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">OpenCode Orchestrator</h1>
          <p className="text-muted-foreground">Automate your software development workflow</p>
        </div>

        <Button onClick={onNewAutomation} size="lg" className="w-full gap-2" disabled={hasActiveSession}>
          <Plus className="h-5 w-5" />
          {hasActiveSession ? 'Stop Active Session First' : 'New Automation'}
        </Button>

        {sessions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Sessions</h2>
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  onClick={() => onSelectSession(session)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{session.project_name}</CardTitle>
                        <CardDescription className="text-xs truncate max-w-[300px]">
                          {session.project_dir}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(session.status)}>
                          {formatStatus(session.status)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete session "${session.project_name}"? This cannot be undone.`)) {
                              deleteSession.mutate(session.id, {
                                onSuccess: () => {
                                  onDeleted?.();
                                },
                                onError: (error) => {
                                  alert(`Failed to delete: ${error}`);
                                },
                              });
                            }
                          }}
                          disabled={deleteSession.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(session.updated_at)}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No sessions yet. Start a new automation to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
