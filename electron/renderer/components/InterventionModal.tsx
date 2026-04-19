import { useState } from 'react';
import { AlertTriangle, Send, SkipForward, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export interface InterventionData {
  ticketId: string;
  title: string;
  attempt: number;
  maxAttempts: number;
  reason: string;
  error?: string;
  lastOutput?: string;
}

interface InterventionModalProps {
  data: InterventionData;
  onResume: () => void;
  onSkip: () => void;
  onAbort: () => void;
  onSendFix: (fix: string) => void;
}

export function InterventionModal({ data, onSkip, onAbort, onSendFix }: InterventionModalProps) {
  const [fixInput, setFixInput] = useState('');

  const handleSendFix = () => {
    onSendFix(fixInput);
    setFixInput('');
  };

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            User Intervention Required
          </DialogTitle>
          <DialogDescription>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Ticket #{data.ticketId}</Badge>
                <Badge variant="outline">{data.attempt}/{data.maxAttempts}</Badge>
              </div>
              <p className="font-medium text-foreground">{data.title}</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Reason</h4>
            <p className="text-sm text-muted-foreground">{data.reason}</p>
          </div>

          {data.error && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Error Details</h4>
              <pre className="p-3 bg-muted rounded-md text-xs text-destructive overflow-auto max-h-32">
                {data.error}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Provide Fix Instructions</h4>
            <Textarea
              value={fixInput}
              onChange={(e) => setFixInput(e.target.value)}
              placeholder="Describe what needs to be fixed or corrected..."
              rows={4}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onSkip}>
            <SkipForward className="h-4 w-4 mr-1" />
            Skip Ticket
          </Button>
          <Button variant="destructive" onClick={onAbort}>
            <XCircle className="h-4 w-4 mr-1" />
            Abort All
          </Button>
          <Button onClick={handleSendFix}>
            <Send className="h-4 w-4 mr-1" />
            Send Fix & Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
