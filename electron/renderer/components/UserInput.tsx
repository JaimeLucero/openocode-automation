import { useState } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export function UserInput({ onSubmit, disabled }: UserInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSubmit(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 bg-card rounded-lg border">
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={disabled ? 'Automation paused or stopped' : 'Enter message for agents...'}
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" disabled={disabled || !message.trim()} size="sm">
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
