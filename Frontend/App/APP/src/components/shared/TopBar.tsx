import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, Globe } from 'lucide-react';
import indusLogo from '@/assets/indus-logo.svg';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface TopBarProps {
  userName: string;
  userRole: string;
  onLogout?: () => void;
}

export const TopBar = ({ userName, userRole, onLogout }: TopBarProps) => {
  const [language, setLanguage] = useState<'EN' | 'اردو'>('EN');
  const navigate = useNavigate();

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'EN' ? 'اردو' : 'EN'));
    toast.success(`Language changed to ${language === 'EN' ? 'اردو' : 'English'}`);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      toast.success('Logged out successfully');
      navigate('/');
    }
  };

  return (
    <div className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <img src={indusLogo} alt="Indus Hospital" className="h-10" />
        <div className="h-8 w-px bg-border" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{userRole}</h2>
          <p className="text-xs text-muted-foreground">Indus Hospital Smart System</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLanguage}
          className="gap-2 font-medium"
        >
          <Globe className="h-4 w-4" />
          {language}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
