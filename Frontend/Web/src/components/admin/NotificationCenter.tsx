import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  CheckCheck,
  Send,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotifications } from '@/hooks/useAdminData';
import { formatDistanceToNow } from 'date-fns';

export function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead, 
    markAllAsRead, 
    createNotification 
  } = useNotifications();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    type: 'info',
    targetRole: 'all',
    isBroadcast: false,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-chart-3" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-chart-4" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'info': 
      default: return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-chart-3/10';
      case 'warning': return 'bg-chart-4/10';
      case 'error': return 'bg-destructive/10';
      case 'info': 
      default: return 'bg-primary/10';
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const handleCreateNotification = async () => {
    if (!newNotification.title || !newNotification.message) {
      toast.error('Please fill in title and message');
      return;
    }

    const { error } = await createNotification(
      newNotification.title,
      newNotification.message,
      newNotification.type,
      newNotification.targetRole === 'all' ? undefined : newNotification.targetRole,
      newNotification.isBroadcast
    );

    if (error) {
      toast.error('Failed to create notification');
    } else {
      toast.success('Notification created');
      setIsCreateOpen(false);
      setNewNotification({ title: '', message: '', type: 'info', targetRole: 'all', isBroadcast: false });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-destructive">{unreadCount} new</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Stay updated with system activities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Notification</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Notification title"
                    value={newNotification.title}
                    onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message *</Label>
                  <Textarea
                    placeholder="Notification message"
                    value={newNotification.message}
                    onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                    className="rounded-xl"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={newNotification.type} 
                      onValueChange={(v) => setNewNotification({ ...newNotification, type: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Role</Label>
                    <Select 
                      value={newNotification.targetRole} 
                      onValueChange={(v) => setNewNotification({ ...newNotification, targetRole: v })}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="All roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="management">Management</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="patient">Patient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleCreateNotification} className="rounded-xl gap-2">
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{notifications.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Unread</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-chart-3/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {notifications.filter(n => n.type === 'success').length}
              </p>
              <p className="text-xs text-muted-foreground">Success</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-chart-4/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {notifications.filter(n => n.type === 'warning').length}
              </p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Notifications List */}
      <Card className="rounded-2xl border-border overflow-hidden">
        {notifications.length > 0 ? (
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 transition-colors cursor-pointer ${!notification.is_read ? 'bg-primary/5' : 'hover:bg-secondary/50'}`}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-xl ${getBgColor(notification.type)} flex items-center justify-center flex-shrink-0`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{notification.title}</p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        {notification.is_broadcast && (
                          <Badge variant="outline" className="text-xs">Broadcast</Badge>
                        )}
                        {notification.target_role && (
                          <Badge variant="outline" className="text-xs capitalize">{notification.target_role}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        )}
      </Card>
    </div>
  );
}
