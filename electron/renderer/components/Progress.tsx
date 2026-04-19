import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';

interface ProgressData {
  total: number;
  completed: number;
  failed: number;
  pending: number;
}

interface ProgressProps {
  data: ProgressData;
}

export function Progress({ data }: ProgressProps) {
  const { total, completed, failed, pending } = data;
  const percentage = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

  return (
    <div className="p-3 bg-card rounded-lg border space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Progress</span>
        <span className="text-muted-foreground">
          {completed}/{total} completed ({percentage}%)
        </span>
      </div>
      <ProgressBar value={percentage} className="h-2" />
      <div className="flex items-center gap-4 text-xs">
        <Badge variant="success" className="gap-1">
          ✓ {completed} completed
        </Badge>
        <Badge variant="destructive" className="gap-1">
          ✗ {failed} failed
        </Badge>
        <Badge variant="secondary" className="gap-1">
          ○ {pending} pending
        </Badge>
      </div>
    </div>
  );
}
