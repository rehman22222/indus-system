import { useState, useMemo, useCallback, memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  UserPlus,
  Search,
  Stethoscope,
  MoreVertical,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Download,
  KeyRound,
  UserCog,
  Save,
  Building2,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAdminDoctorManagement } from '@/hooks/useAdminData';
import { useDepartments } from '@/hooks/useDepartments';
import { useStaffCredentials } from '@/hooks/useStaffCredentials';
import { Progress } from '@/components/ui/progress';

// Memoized DoctorCard component to prevent unnecessary re-renders
const DoctorCard = memo(({ doctor, onEdit, onDeactivate }: { doctor: any; onEdit: (doctor: any) => void; onDeactivate: (id: string) => void }) => (
  <Card className="p-5 rounded-2xl border-border hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: doctor.department?.color ? `${doctor.department.color}20` : 'hsl(var(--primary) / 0.1)' }}>
          <Stethoscope className="h-6 w-6" style={{ color: doctor.department?.color || 'hsl(var(--primary))' }} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{doctor.name}</h3>
          <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2" onClick={() => onEdit(doctor)}>
            <Edit2 className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <UserCog className="h-4 w-4" /> Link Account
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => onDeactivate(doctor.id)}>
            <Trash2 className="h-4 w-4" /> Deactivate
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="space-y-3">
      {doctor.department && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Department</span>
          <Badge variant="outline" style={{ borderColor: doctor.department.color, color: doctor.department.color }}>
            {doctor.department.name}
          </Badge>
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Daily Quota</span>
        <span className="font-medium">{doctor.daily_physical_quota} physical / {doctor.daily_video_quota} video</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Status</span>
        <Badge className={doctor.is_active ? 'bg-chart-3' : 'bg-muted'}>{doctor.is_active ? 'Active' : 'Inactive'}</Badge>
      </div>
      {doctor.user_id && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Account</span>
          <Badge variant="outline" className="gap-1 bg-chart-3/10 text-chart-3"><KeyRound className="h-3 w-3" /> Linked</Badge>
        </div>
      )}
      <div className="flex items-center gap-2 pt-2">
        {doctor.phone && <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" />Contact</Badge>}
        {doctor.email && <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />Email</Badge>}
      </div>
    </div>
  </Card>
));

export function DoctorManagement() {
  const { doctors, isLoading, createDoctor, updateDoctor, deactivateDoctor, refetch } = useAdminDoctorManagement();
  const { departments, refetch: refetchDepartments, createDepartment } = useDepartments();
  const { createStaffAccount, isCreating } = useStaffCredentials();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCredentialsOpen, setIsCredentialsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [newDepartment, setNewDepartment] = useState({ name: '', description: '', color: '#0ea5e9' });
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const [newDoctor, setNewDoctor] = useState({
    name: '',
    specialty: '',
    departmentId: '',
    phone: '',
    email: '',
    dailyPhysicalQuota: 30,
    dailyVideoQuota: 10,
  });

  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    role: 'doctor' as 'admin' | 'management' | 'doctor' | 'receptionist',
    specialty: '',
    departmentId: '',
    dailyPhysicalQuota: 30,
    dailyVideoQuota: 10,
  });

  const specialties = useMemo(() =>
    [...new Set(doctors.map(d => d.specialty))].filter(Boolean),
    [doctors]
  );

  const filteredDoctors = useMemo(() =>
    doctors.filter((doctor: any) => {
      const matchesSearch = doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty = selectedSpecialty === 'all' || doctor.specialty === selectedSpecialty;
      const matchesDepartment = selectedDepartment === 'all' || doctor.department_id === selectedDepartment;
      return matchesSearch && matchesSpecialty && matchesDepartment;
    }),
    [doctors, searchQuery, selectedSpecialty, selectedDepartment]
  );

  const handleCreateDoctor = useCallback(async () => {
    if (!newDoctor.name || !newDoctor.specialty) {
      toast.error('Please fill in required fields');
      return;
    }
    const { error } = await createDoctor(newDoctor);
    if (error) {
      toast.error('Failed to create doctor');
    } else {
      toast.success('Doctor added successfully');
      setIsAddOpen(false);
      setNewDoctor({ name: '', specialty: '', departmentId: '', phone: '', email: '', dailyPhysicalQuota: 30, dailyVideoQuota: 10 });
    }
  }, [newDoctor, createDoctor]);

  const handleEditDoctor = useCallback((doctor: any) => {
    setEditingDoctor({
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      department_id: doctor.department_id || '',
      phone: doctor.phone || '',
      email: doctor.email || '',
      daily_physical_quota: doctor.daily_physical_quota || 30,
      daily_video_quota: doctor.daily_video_quota || 10,
      is_active: doctor.is_active,
    });
    setIsEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingDoctor) return;
    const { id, ...updates } = editingDoctor;
    const { error } = await updateDoctor(id, {
      name: updates.name,
      specialty: updates.specialty,
      department_id: updates.department_id || null,
      phone: updates.phone || null,
      email: updates.email || null,
      daily_physical_quota: updates.daily_physical_quota,
      daily_video_quota: updates.daily_video_quota,
      is_active: updates.is_active,
    });
    if (error) {
      toast.error('Failed to update doctor');
    } else {
      toast.success('Doctor updated successfully');
      setIsEditOpen(false);
      setEditingDoctor(null);
    }
  }, [editingDoctor, updateDoctor]);

  const handleCreateCredentials = useCallback(async () => {
    if (!credentials.email || !credentials.password || !credentials.fullName) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (credentials.password !== credentials.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (credentials.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    // Department is required for doctors — it's persisted to
    // doctors.department_id (the only role with a department column).
    if (credentials.role === 'doctor' && !credentials.departmentId) {
      toast.error('Please select a department');
      return;
    }
    const result = await createStaffAccount(
      credentials.email,
      credentials.password,
      credentials.fullName,
      credentials.role,
      credentials.role === 'doctor' ? {
        phone: credentials.phone,
        specialty: credentials.specialty,
        departmentId: credentials.departmentId,
        dailyPhysicalQuota: credentials.dailyPhysicalQuota,
        dailyVideoQuota: credentials.dailyVideoQuota,
      } : { phone: credentials.phone }
    );
    if (result.success) {
      const roleLabel = credentials.role.charAt(0).toUpperCase() + credentials.role.slice(1);
      toast.success(`${roleLabel} account created`, {
        description: `They can now sign in at the login page with ${credentials.email}`,
      });
      setIsCredentialsOpen(false);
      setCredentials({ email: '', password: '', confirmPassword: '', fullName: '', phone: '', role: 'doctor', specialty: '', departmentId: '', dailyPhysicalQuota: 30, dailyVideoQuota: 10 });
      // Re-pull live Supabase rows so the newly-inserted doctor card
      // appears immediately without a manual refresh.
      if (credentials.role === 'doctor') await refetch();
    } else {
      toast.error(result.error || 'Failed to create account');
    }
  }, [credentials, createStaffAccount, refetch]);

  const handleCreateDepartment = useCallback(async () => {
    if (!newDepartment.name.trim()) {
      toast.error('Department name is required');
      return;
    }
    setIsSavingDept(true);
    const { error } = await createDepartment({
      name: newDepartment.name,
      description: newDepartment.description,
      color: newDepartment.color,
    });
    setIsSavingDept(false);
    if (error) {
      toast.error(error.message || 'Failed to create department');
    } else {
      toast.success(`Department "${newDepartment.name.trim()}" created`);
      setNewDepartment({ name: '', description: '', color: '#0ea5e9' });
    }
  }, [newDepartment, createDepartment]);

  const handleDeactivate = useCallback(async (doctorId: string) => {
    const { error } = await deactivateDoctor(doctorId);
    if (error) toast.error('Failed to deactivate doctor');
    else toast.success('Doctor deactivated');
  }, [deactivateDoctor]);

  const exportToCSV = useCallback(() => {
    const headers = ['Name', 'Specialty', 'Department', 'Physical Quota', 'Video Quota', 'Phone', 'Email', 'Status'];
    const rows = filteredDoctors.map((doctor: any) => [
      doctor.name, doctor.specialty, doctor.department?.name || '-',
      doctor.daily_physical_quota, doctor.daily_video_quota,
      doctor.phone || '-', doctor.email || '-', doctor.is_active ? 'Active' : 'Inactive',
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `doctors_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Doctors list exported successfully');
  }, [filteredDoctors]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Doctor & Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage doctors, create credentials, and configure quotas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog
            open={isDeptOpen}
            onOpenChange={(open) => {
              setIsDeptOpen(open);
              if (open) refetchDepartments();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl gap-2">
                <Building2 className="h-4 w-4" />
                Manage Departments
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Manage Departments</DialogTitle>
                <DialogDescription>
                  Create departments here — they immediately become available in the Add Doctor and Create Staff forms.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Department Name *</Label>
                    <Input
                      placeholder="e.g., Cardiology"
                      value={newDepartment.name}
                      onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={newDepartment.color}
                      onChange={(e) => setNewDepartment({ ...newDepartment, color: e.target.value })}
                      className="rounded-xl h-10 w-16 p-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Short description (optional)"
                    value={newDepartment.description}
                    onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <Button onClick={handleCreateDepartment} disabled={isSavingDept} className="rounded-xl gap-2 w-full">
                  <Plus className="h-4 w-4" />
                  {isSavingDept ? 'Adding...' : 'Add Department'}
                </Button>

                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Existing Departments ({departments.length})
                  </p>
                  {departments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No departments yet. Add your first one above.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-2">
                      {departments.map((dept) => (
                        <div key={dept.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                          <span
                            className="h-4 w-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dept.color }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{dept.name}</p>
                            {dept.description && (
                              <p className="text-xs text-muted-foreground truncate">{dept.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeptOpen(false)} className="rounded-xl">Done</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl gap-2">
                <UserPlus className="h-4 w-4" />
                Add Doctor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Doctor</DialogTitle>
                <DialogDescription>Enter the doctor's profile and daily appointment quotas.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input placeholder="Dr. John Doe" value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Specialty *</Label>
                  <Input placeholder="e.g., Cardiology" value={newDoctor.specialty} onChange={(e) => setNewDoctor({ ...newDoctor, specialty: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={newDoctor.departmentId} onValueChange={(v) => setNewDoctor({ ...newDoctor, departmentId: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Physical Quota</Label>
                    <Input type="number" value={newDoctor.dailyPhysicalQuota} onChange={(e) => setNewDoctor({ ...newDoctor, dailyPhysicalQuota: parseInt(e.target.value) })} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>Video Quota</Label>
                    <Input type="number" value={newDoctor.dailyVideoQuota} onChange={(e) => setNewDoctor({ ...newDoctor, dailyVideoQuota: parseInt(e.target.value) })} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+92 XXX XXXXXXX" value={newDoctor.phone} onChange={(e) => setNewDoctor({ ...newDoctor, phone: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="doctor@indus.org.pk" value={newDoctor.email} onChange={(e) => setNewDoctor({ ...newDoctor, email: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleCreateDoctor} className="rounded-xl">Add Doctor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isCredentialsOpen}
            onOpenChange={(open) => {
              setIsCredentialsOpen(open);
              // Fetch the departments list live from Supabase each time
              // the Create Staff form opens so the dropdown is current.
              if (open) refetchDepartments();
            }}
          >
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2">
                <KeyRound className="h-4 w-4" />
                Create Staff Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Staff Account</DialogTitle>
                <DialogDescription>
                  Create login credentials for a Doctor, Management, Receptionist or Admin user. They can sign in immediately at the login page.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="doctor" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="doctor" onClick={() => setCredentials(c => ({ ...c, role: 'doctor' }))}>Doctor</TabsTrigger>
                  <TabsTrigger value="management" onClick={() => setCredentials(c => ({ ...c, role: 'management' }))}>Management</TabsTrigger>
                  <TabsTrigger value="receptionist" onClick={() => setCredentials(c => ({ ...c, role: 'receptionist' }))}>Receptionist</TabsTrigger>
                  <TabsTrigger value="admin" onClick={() => setCredentials(c => ({ ...c, role: 'admin' }))}>Admin</TabsTrigger>
                </TabsList>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input placeholder="Full name" value={credentials.fullName} onChange={(e) => setCredentials({ ...credentials, fullName: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input placeholder="+92 XXX XXXXXXX" value={credentials.phone} onChange={(e) => setCredentials({ ...credentials, phone: e.target.value })} className="rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="staff@indus.org.pk" value={credentials.email} onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} className="rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input type="password" placeholder="Min 6 characters" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm Password *</Label>
                      <Input type="password" placeholder="Confirm password" value={credentials.confirmPassword} onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.target.value })} className="rounded-xl" />
                    </div>
                  </div>
                  {credentials.role === 'doctor' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Specialty *</Label>
                          <Input placeholder="e.g., Cardiology" value={credentials.specialty} onChange={(e) => setCredentials({ ...credentials, specialty: e.target.value })} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Department *</Label>
                          <Select value={credentials.departmentId} onValueChange={(v) => setCredentials({ ...credentials, departmentId: v })}>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder={departments.length ? 'Select department' : 'No departments found'} />
                            </SelectTrigger>
                            <SelectContent>{departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Physical Quota</Label>
                          <Input type="number" value={credentials.dailyPhysicalQuota} onChange={(e) => setCredentials({ ...credentials, dailyPhysicalQuota: parseInt(e.target.value) })} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Video Quota</Label>
                          <Input type="number" value={credentials.dailyVideoQuota} onChange={(e) => setCredentials({ ...credentials, dailyVideoQuota: parseInt(e.target.value) })} className="rounded-xl" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCredentialsOpen(false)} className="rounded-xl">Cancel</Button>
                <Button onClick={handleCreateCredentials} disabled={isCreating} className="rounded-xl">
                  {isCreating ? 'Creating...' : 'Create Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Doctor Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>Update the doctor's profile, specialty and quotas.</DialogDescription>
          </DialogHeader>
          {editingDoctor && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={editingDoctor.name} onChange={(e) => setEditingDoctor({ ...editingDoctor, name: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Specialty *</Label>
                <Input value={editingDoctor.specialty} onChange={(e) => setEditingDoctor({ ...editingDoctor, specialty: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={editingDoctor.department_id} onValueChange={(v) => setEditingDoctor({ ...editingDoctor, department_id: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map(dept => <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Physical Quota</Label>
                  <Input type="number" value={editingDoctor.daily_physical_quota} onChange={(e) => setEditingDoctor({ ...editingDoctor, daily_physical_quota: parseInt(e.target.value) })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Video Quota</Label>
                  <Input type="number" value={editingDoctor.daily_video_quota} onChange={(e) => setEditingDoctor({ ...editingDoctor, daily_video_quota: parseInt(e.target.value) })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={editingDoctor.phone} onChange={(e) => setEditingDoctor({ ...editingDoctor, phone: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={editingDoctor.email} onChange={(e) => setEditingDoctor({ ...editingDoctor, email: e.target.value })} className="rounded-xl" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveEdit} className="rounded-xl gap-2">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
          <SelectTrigger className="w-[180px] rounded-xl"><SelectValue placeholder="Filter by specialty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specialties</SelectItem>
            {specialties.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-[180px] rounded-xl"><SelectValue placeholder="Filter by department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="rounded-xl gap-2" onClick={exportToCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Total Doctors</p>
          <p className="text-2xl font-bold text-foreground">{doctors.length}</p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-chart-3">{doctors.filter((d: any) => d.is_active).length}</p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Departments</p>
          <p className="text-2xl font-bold text-primary">{departments.length}</p>
        </Card>
        <Card className="p-4 rounded-xl border-border">
          <p className="text-sm text-muted-foreground">Specialties</p>
          <p className="text-2xl font-bold text-chart-4">{specialties.length}</p>
        </Card>
      </div>

      {/* Doctor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDoctors.map((doctor: any) => (
          <DoctorCard key={doctor.id} doctor={doctor} onEdit={handleEditDoctor} onDeactivate={handleDeactivate} />
        ))}
      </div>

      {filteredDoctors.length === 0 && (
        <div className="text-center py-12">
          <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No doctors found matching your search</p>
        </div>
      )}
    </div>
  );
}
