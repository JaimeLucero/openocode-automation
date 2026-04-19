import { Pause, Play, SkipForward, Square, Home, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ControlBarProps {
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onForceStop: () => void;
  onSkip: () => void;
  onHome: () => void;
}

export function ControlBar({
  isRunning,
  isPaused,
  onPause,
  onResume,
  onStop,
  onForceStop,
  onSkip,
  onHome,
}: ControlBarProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
      <div className="flex items-center gap-2">
        {isRunning && !isPaused && (
          <Button variant="outline" size="sm" onClick={onPause}>
            <Pause className="h-4 w-4 mr-1" />
            Pause
          </Button>
        )}
        {isRunning && isPaused && (
          <Button size="sm" onClick={onResume}>
            <Play className="h-4 w-4 mr-1" />
            Resume
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onSkip}
          disabled={!isRunning}
        >
          <SkipForward className="h-4 w-4 mr-1" />
          Skip
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          disabled={!isRunning}
        >
          <Square className="h-4 w-4 mr-1" />
          Stop
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onForceStop}
          disabled={!isRunning}
        >
          <Zap className="h-4 w-4 mr-1" />
          Force Stop
        </Button>
      </div>
      <div className="flex items-center gap-3">
        {isRunning && (
          <Badge variant={isPaused ? "secondary" : "success"}>
            {isPaused ? 'Paused' : 'Running'}
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={onHome}>
          <Home className="h-4 w-4 mr-1" />
          Home
        </Button>
      </div>
    </div>
  );
}
