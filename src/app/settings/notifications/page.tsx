'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { useFirestore } from '@/firebase';
import { 
    collection, 
    query, 
    getDocs, 
    doc, 
    setDoc, 
    deleteDoc, 
    onSnapshot,
    Timestamp,
    orderBy
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { 
    Bell, 
    Plus, 
    Users, 
    Send, 
    Smartphone, 
    ShieldCheck, 
    Trash2, 
    Edit, 
    CheckCircle2, 
    XCircle,
    Info,
    Settings2,
    Check,
    Search,
    AlertTriangle,
    Mail,
    ChevronRight,
    Loader2
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription,
    DialogFooter 
} from '@/components/ui/dialog';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BrandedLoader } from '@/components/branded-loader';
import { getNestedValue } from '@/lib/utils';
import type { NotificationGroup, UserProfile } from '@/lib/types';

const MODULES = [
    { id: 'leads', name: 'Leads' },
    { id: 'campaigns', name: 'Campaigns' },
    { id: 'donations', name: 'Donations' },
    { id: 'beneficiaries', name: 'Beneficiaries' },
    { id: 'users', name: 'Users' },
    { id: 'approvals', name: 'Approvals' }
];

export default function NotificationSettingsPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [groups, setGroups] = useState<NotificationGroup[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingGroup, setEditingGroup] = useState<Partial<NotificationGroup> | null>(null);

    const canUpdate = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.settings.notifications.update', false);

    useEffect(() => {
        if (!firestore) return;

        // Fetch Users
        const fetchUsers = async () => {
            const userSnap = await getDocs(query(collection(firestore, 'users'), orderBy('name')));
            setUsers(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
        };

        // Stream Notification Groups
        const unsubscribe = onSnapshot(collection(firestore, 'notification_groups'), (snapshot) => {
            setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationGroup)));
            setIsLoading(false);
        });

        fetchUsers();
        return () => unsubscribe();
    }, [firestore]);

    const handleOpenDialog = (group?: NotificationGroup) => {
        if (group) {
            setEditingGroup({ ...group });
        } else {
            setEditingGroup({
                name: '',
                type: 'Telegram',
                channelType: 'Group',
                memberIds: [],
                enabledModules: ['leads', 'donations'],
                isActive: true
            });
        }
        setIsDialogOpen(true);
    };

    const handleSaveGroup = async () => {
        if (!firestore || !editingGroup || !editingGroup.name) return;
        
        setIsSubmitting(true);
        try {
            const groupId = editingGroup.id || `group_${Date.now()}`;
            const groupRef = doc(firestore, 'notification_groups', groupId);
            
            await setDoc(groupRef, {
                ...editingGroup,
                id: groupId,
                updatedAt: Timestamp.now()
            }, { merge: true });

            toast({ title: 'Group Saved', description: 'Notification group configuration updated.', variant: 'success' });
            setIsDialogOpen(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!firestore || !confirm('Are you sure you want to delete this notification group?')) return;
        
        try {
            await deleteDoc(doc(firestore, 'notification_groups', id));
            toast({ title: 'Deleted', description: 'Notification group removed.' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const toggleMember = (userId: string) => {
        setEditingGroup(prev => {
            if (!prev) return null;
            const current = prev.memberIds || [];
            const updated = current.includes(userId) 
                ? current.filter(id => id !== userId)
                : [...current, userId];
            return { ...prev, memberIds: updated };
        });
    };

    const toggleModule = (moduleId: any) => {
        setEditingGroup(prev => {
            if (!prev) return null;
            const current = prev.enabledModules || [];
            const updated = current.includes(moduleId)
                ? current.filter(m => m !== moduleId)
                : [...current, moduleId];
            return { ...prev, enabledModules: updated as any };
        });
    };

    if (isSessionLoading || isLoading) {
        return <BrandedLoader message="Loading Notification Registry..." />;
    }

    const filteredUsers = users.filter(u => 
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.phone?.includes(searchQuery)
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <Bell className="h-6 w-6 text-primary/40" />
                        Notification Management
                    </h2>
                    <p className="text-sm text-muted-foreground">Orchestrate how and where institutional alerts are delivered.</p>
                </div>
                {canUpdate && (
                    <Button onClick={() => handleOpenDialog()} className="font-bold shadow-md transition-transform active:scale-95">
                        <Plus className="mr-2 h-4 w-4" /> Create Alert Group
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                    <Card className="col-span-full py-20 border-dashed bg-muted/5 flex flex-col items-center justify-center text-center">
                        <div className="p-4 rounded-full bg-primary/5 mb-4">
                            <Send className="h-10 w-10 text-primary/20" />
                        </div>
                        <h3 className="text-lg font-bold text-primary opacity-60">No Notification Groups</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mt-2">Create groups to route verification alerts and system updates to specific team members.</p>
                        <Button variant="outline" onClick={() => handleOpenDialog()} className="mt-6 font-bold">
                            Initialize First Group
                        </Button>
                    </Card>
                ) : (
                    groups.map(group => (
                        <Card key={group.id} className="overflow-hidden border-primary/10 hover:shadow-md transition-all group">
                            <div className={`h-1.5 w-full ${group.type === 'Telegram' ? 'bg-sky-500' : 'bg-green-500'}`} />
                            <CardHeader className="pb-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg font-bold text-primary leading-none">{group.name}</CardTitle>
                                            {!group.isActive && <Badge variant="outline" className="text-[9px] h-4 bg-muted/20">DISABLED</Badge>}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                            {group.type === 'Telegram' ? <Send className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                                            {group.type} • {group.channelType}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/60 hover:text-primary" onClick={() => handleOpenDialog(group)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDeleteGroup(group.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Subscribed Modules</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.enabledModules.map(mod => (
                                            <Badge key={mod} variant="secondary" className="bg-primary/5 text-primary text-[9px] font-bold px-1.5 py-0">
                                                {mod}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-primary/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex -space-x-2">
                                            {group.memberIds.slice(0, 3).map(id => {
                                                const u = users.find(user => user.id === id);
                                                return (
                                                    <div key={id} className="h-6 w-6 rounded-full bg-muted border border-white flex items-center justify-center text-[10px] font-bold text-primary">
                                                        {u?.name?.charAt(0) || '?'}
                                                    </div>
                                                );
                                            })}
                                            {group.memberIds.length > 3 && (
                                                <div className="h-6 w-6 rounded-full bg-muted border border-white flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                                                    +{group.memberIds.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-medium">
                                            {group.memberIds.length} recipient{group.memberIds.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-primary/20" />
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle>{editingGroup?.id ? 'Edit Alert Group' : 'Create Alert Group'}</DialogTitle>
                        <DialogDescription>Configure routing rules and recipient membership for this notification group.</DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Group Name</Label>
                                <Input 
                                    placeholder="e.g. Finance Approval Team" 
                                    value={editingGroup?.name || ''} 
                                    onChange={e => setEditingGroup(prev => prev ? { ...prev, name: e.target.value } : null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Protocol</Label>
                                <Select 
                                    value={editingGroup?.type} 
                                    onValueChange={(val: any) => setEditingGroup(prev => prev ? { ...prev, type: val } : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Telegram">Telegram Messenger</SelectItem>
                                        <SelectItem value="WhatsApp">WhatsApp Messenger</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold">Delivery Mode</Label>
                                <Select 
                                    value={editingGroup?.channelType} 
                                    onValueChange={(val: any) => setEditingGroup(prev => prev ? { ...prev, channelType: val } : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Group">Unified Group Chat</SelectItem>
                                        <SelectItem value="Individual">Direct Individual Alerts</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {editingGroup?.channelType === 'Group' && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold">Target Chat ID</Label>
                                    <Input 
                                        placeholder="-100123456789" 
                                        value={editingGroup?.targetId || ''} 
                                        onChange={e => setEditingGroup(prev => prev ? { ...prev, targetId: e.target.value } : null)}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Enter the Telegram group ID where messages will be posted.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <Label className="text-xs font-bold">Associated Modules</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {MODULES.map(mod => (
                                    <div key={mod.id} className="flex items-center space-x-2 p-2 rounded-lg border bg-muted/5">
                                        <Checkbox 
                                            id={`mod-${mod.id}`}
                                            checked={editingGroup?.enabledModules?.includes(mod.id as any)}
                                            onCheckedChange={() => toggleModule(mod.id)}
                                        />
                                        <label htmlFor={`mod-${mod.id}`} className="text-xs font-medium cursor-pointer">{mod.name}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold">Group Membership</Label>
                                <div className="relative w-48">
                                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search users..." 
                                        className="h-8 pl-8 text-[10px]" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="border rounded-xl divide-y overflow-hidden max-h-60 overflow-y-auto bg-muted/5">
                                {filteredUsers.map(user => (
                                    <div 
                                        key={user.id} 
                                        className={`flex items-center justify-between p-3 hover:bg-muted/10 cursor-pointer transition-colors ${editingGroup?.memberIds?.includes(user.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleMember(user.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                                                {user.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-primary">{user.name}</p>
                                                <p className="text-[10px] text-muted-foreground">{user.role} • {user.phone || 'No Phone'}</p>
                                            </div>
                                        </div>
                                        {editingGroup?.memberIds?.includes(user.id) ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <div className="h-5 w-5 rounded-full border-2 border-muted" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-amber-900">Active Status</Label>
                                <p className="text-[10px] text-amber-800">Toggle this group to enable or pause all linked notifications.</p>
                            </div>
                            <Switch 
                                checked={editingGroup?.isActive ?? true}
                                onCheckedChange={checked => setEditingGroup(prev => prev ? { ...prev, isActive: checked } : null)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 bg-muted/20 border-t gap-2">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting} className="font-bold">Cancel</Button>
                        <Button onClick={handleSaveGroup} disabled={isSubmitting || !editingGroup?.name} className="font-bold shadow-md">
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Commit Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-primary/10 bg-primary/5 p-4 border-dashed">
                <div className="flex gap-3">
                    <div className="p-2 bg-white rounded-full shadow-sm text-primary h-fit">
                        <Info className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">Intelligent Routing Guide</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li><strong>Telegram Group:</strong> Best for team collaboration. Everyone sees every alert.</li>
                            <li><strong>WhatsApp Individual:</strong> Best for high-priority alerts. Each member gets a personal DM.</li>
                            <li><strong>Whapi vs Meta:</strong> WhatsApp alerts will use your "Active Provider" set in Resource Config.</li>
                            <li><strong>Efficiency:</strong> Moving staff alerts to Telegram is the best way to keep your WhatsApp free tier for donors.</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
