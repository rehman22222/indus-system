import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';

interface BroadcastPanelProps {
  onSendBroadcast: (message: string, title: string, targetRole?: 'admin' | 'management' | 'doctor' | 'patient' | 'receptionist') => Promise<void>;
  isSending: boolean;
}

export function BroadcastPanel({ onSendBroadcast, isSending }: BroadcastPanelProps) {
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [targetRole, setTargetRole] = useState<string>('all');

  const handleSend = async () => {
    if (broadcastMessage.trim() && broadcastTitle.trim()) {
      const role = targetRole === 'all' ? undefined : targetRole as 'admin' | 'management' | 'doctor' | 'patient' | 'receptionist';
      await onSendBroadcast(broadcastMessage, broadcastTitle, role);
      setBroadcastMessage('');
      setBroadcastTitle('');
      setTargetRole('all');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">System-Wide Broadcast</h1>
      <Card className="p-6 rounded-3xl shadow-sm border-border">
        <div className="space-y-4">
          <div>
            <Label htmlFor="broadcast-title" className="text-base font-semibold">
              Broadcast Title
            </Label>
            <Input
              id="broadcast-title"
              placeholder="Enter notification title..."
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="mt-2 rounded-xl"
            />
          </div>

          <div>
            <Label htmlFor="target-role" className="text-base font-semibold">
              Target Audience
            </Label>
            <Select value={targetRole} onValueChange={setTargetRole}>
              <SelectTrigger className="mt-2 rounded-xl">
                <SelectValue placeholder="Select target audience" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="patient">Patients Only</SelectItem>
                <SelectItem value="doctor">Doctors Only</SelectItem>
                <SelectItem value="management">Management Only</SelectItem>
                <SelectItem value="receptionist">Receptionists Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="broadcast-message" className="text-base font-semibold">
              Broadcast Message
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              This message will be sent as a notification to the selected audience.
            </p>
            <Textarea
              id="broadcast-message"
              placeholder="Type your message here..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="min-h-32 rounded-2xl"
            />
          </div>

          <div className="flex justify-between items-center p-4 bg-secondary rounded-2xl">
            <div>
              <p className="font-medium">Recipients</p>
              <p className="text-sm text-muted-foreground">
                {targetRole === 'all' 
                  ? 'All system users' 
                  : `All ${targetRole}s in the system`
                }
              </p>
            </div>
            <Button
              onClick={handleSend}
              disabled={!broadcastMessage.trim() || !broadcastTitle.trim() || isSending}
              size="lg"
              className="rounded-2xl gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Broadcast
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
