'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/use-session';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Loader2, 
    Save, 
    MessageSquare, 
    Variable, 
    Smartphone, 
    ShieldCheck, 
    Plus, 
    Trash2,
    PlayCircle,
    Info,
    RefreshCw,
    Search,
    Filter,
    ArrowLeft,
    CheckCircle2,
    AlertCircle,
    Send,
    Mail,
    User as UserIcon
} from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuCheckboxItem, 
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { BrandedLoader } from '@/components/branded-loader';
import { 
    seedDefaultTemplatesAction, 
    deleteTemplateAction,
    sendWhatsAppAction,
    sendTelegramAction,
    sendEmailAction,
    searchMessagingUsersAction
} from '@/app/messages/actions';
import type { MessageTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function MessageTemplatesPage() {
    const { userProfile, isLoading: isSessionLoading } = useSession();
    const firestore = useFirestore();
    const { toast } = useToast();

    // Filtering State
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [profileFilter, setProfileFilter] = useState<string>('All');

    const templatesRef = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'settings', 'message_templates', 'templates'), orderBy('name')) : null, 
    [firestore]);

    const { data: rawTemplates, isLoading: isTemplatesLoading } = useCollection<MessageTemplate>(templatesRef);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<MessageTemplate> | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const [hasAutoSeeded, setHasAutoSeeded] = useState(false);

    // Test Center State
    const [testSearchQuery, setTestSearchQuery] = useState('');
    const [testUsers, setTestUsers] = useState<any[]>([]);
    const [selectedTestUser, setSelectedTestUser] = useState<any | null>(null);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [isTestingChannel, setIsTestingChannel] = useState<string | null>(null); // 'WhatsApp', 'Telegram', 'Email'
    const [testTab, setTestTab] = useState<'Telegram' | 'WhatsApp' | 'Email'>('Telegram');

    const canManageTemplates = userProfile?.role === 'Admin';

    // Categories for filter
    const categories = useMemo(() => {
        if (!rawTemplates) return ['All'];
        const cats = Array.from(new Set(rawTemplates.map(t => t.category).filter(Boolean)));
        return ['All', ...cats];
    }, [rawTemplates]);

    const profiles = ['All', 'Member', 'Donor', 'Beneficiary', 'Admin', 'General'];

    // Clientside Filtering
    const filteredTemplates = useMemo(() => {
        if (!rawTemplates) return [];
        return rawTemplates.filter(t => {
            const matchesSearch = 
                t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.profileType && t.profileType.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
            const matchesProfile = profileFilter === 'All' || t.profileType === profileFilter;
            
            return matchesSearch && matchesCategory && matchesProfile;
        });
    }, [rawTemplates, searchTerm, categoryFilter, profileFilter]);

    // Auto-seed if empty and admin
    useEffect(() => {
        if (!isTemplatesLoading && rawTemplates && rawTemplates.length === 0 && canManageTemplates && !hasAutoSeeded && !isSeeding) {
            setHasAutoSeeded(true);
            handleSeed();
        }
    }, [rawTemplates, isTemplatesLoading, canManageTemplates, hasAutoSeeded, isSeeding]);

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (testSearchQuery.length >= 2) {
                setIsSearchingUsers(true);
                const results = await searchMessagingUsersAction(testSearchQuery);
                setTestUsers(results);
                setIsSearchingUsers(false);
            } else {
                setTestUsers([]);
            }
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [testSearchQuery]);

    const handleChannelTest = async (channel: 'WhatsApp' | 'Telegram' | 'Email') => {
        if (!selectedTestUser || !editData) {
            toast({ title: 'Missing Context', description: 'Select a user and a template first.', variant: 'destructive' });
            return;
        }

        const variables: Record<string, string> = {};
        editData.variables?.forEach(v => {
            if (v === 'name') variables[v] = selectedTestUser.name;
            else if (v === 'otp') variables[v] = Math.floor(100000 + Math.random() * 900000).toString();
            else if (v === 'validity') variables[v] = '5';
            else if (v === 'amount') variables[v] = '500';
            else if (v === 'donorName') variables[v] = selectedTestUser.name;
            else if (v === 'beneficiaryName') variables[v] = selectedTestUser.name;
            else if (v === 'causeName') variables[v] = 'Emergency Medical Fund';
            else if (v === 'percent') variables[v] = '75';
            else if (v === 'url') variables[v] = 'https://baitulamalsolapur.com';
            else variables[v] = `[${v}]`;
        });

        setIsTestingChannel(channel);
        try {
            let res: any;
            if (channel === 'WhatsApp') {
                if (!selectedTestUser.phone) throw new Error('User has no phone number.');
                res = await sendWhatsAppAction({
                    to: selectedTestUser.phone,
                    templateId: editData.id,
                    variables,
                    bypassAutoCheck: true
                });
            } else if (channel === 'Telegram') {
                if (!selectedTestUser.telegramChatId) throw new Error('User has no Telegram Chat ID.');
                res = await sendTelegramAction({
                    templateId: editData.id,
                    variables,
                    chatId: selectedTestUser.telegramChatId,
                    configOverride: selectedTestUser.customTelegramBotToken ? { telegramBotToken: selectedTestUser.customTelegramBotToken } : undefined,
                    bypassAutoCheck: true
                });
            } else if (channel === 'Email') {
                if (!selectedTestUser.email || selectedTestUser.email.includes('@donor.demo.local')) throw new Error('User has no valid email.');
                res = await sendEmailAction({
                    to: selectedTestUser.email,
                    templateId: editData.id,
                    variables,
                    bypassAutoCheck: true
                });
            }

            if (res?.success) {
                toast({ title: `${channel} Test Dispatched`, description: 'Verification message sent successfully.', variant: 'success' });
            } else {
                toast({ title: 'Dispatch Failed', description: res?.message || 'Unknown provider error.', variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'Test Failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsTestingChannel(null);
        }
    };

    const handleEdit = (template: MessageTemplate) => {
        setEditingId(template.id);
        setEditData(template);
    };

    const handleNew = () => {
        const id = `template_${Date.now()}`;
        setEditingId(id);
        setEditData({
            id,
            name: 'New Template',
            subject: '',
            body: '',
            type: 'MultiChannel',
            category: 'Alert',
            profileType: 'All',
            variables: [],
            isActive: true
        });
    };

    const handleSave = async () => {
        if (!firestore || !editData || !editingId) return;
        setIsSubmitting(true);
        try {
            await setDoc(doc(firestore, 'settings', 'message_templates', 'templates', editingId), editData, { merge: true });
            toast({ title: 'Template Saved', variant: 'success' });
            setEditingId(null);
            setEditData(null);
        } catch (e: any) {
            toast({ title: 'Save Failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!editingId || !confirm('Are you sure you want to delete this template?')) return;
        setIsSubmitting(true);
        try {
            const result = await deleteTemplateAction(editingId);
            if (result.success) {
                toast({ title: 'Template Deleted', variant: 'success' });
                setEditingId(null);
                setEditData(null);
            } else {
                toast({ title: 'Delete Failed', description: result.message, variant: 'destructive' });
            }
        } catch (e: any) {
            toast({ title: 'System Error', description: e.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSeed = async () => {
        setIsSeeding(true);
        try {
            await seedDefaultTemplatesAction();
            toast({ title: 'Defaults Restored', description: 'Core templates have been synchronized.', variant: 'success' });
        } catch (e: any) {
            toast({ title: 'Sync Failed', description: e.message, variant: 'destructive' });
        } finally {
            setIsSeeding(false);
        }
    };

    if (isSessionLoading || isTemplatesLoading) {
        return <BrandedLoader message="Syncing Message Templates..." />;
    }

    if (!canManageTemplates) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <ShieldCheck className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-primary">Unauthorized Access</h3>
                <p className="text-sm text-muted-foreground">Only system administrators can modify automated message templates.</p>
                <Button variant="outline" className="mt-6" asChild>
                    <Link href="/messages">Back to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 text-primary font-normal pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary/40 hover:text-primary">
                        <Link href="/messages"><ArrowLeft className="h-5 w-5" /></Link>
                    </Button>
                    <div className="space-y-0.5">
                        <h2 className="text-2xl font-bold tracking-tight text-primary">Message Templates</h2>
                        <p className="text-sm text-muted-foreground font-normal">Standardize automated notification content.</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleSeed} disabled={isSeeding} className="font-bold border-primary/10 shadow-sm transition-transform active:scale-95">
                        {isSeeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Restore Defaults
                    </Button>
                    <Button onClick={handleNew} className="font-bold shadow-md transition-transform active:scale-95">
                        <Plus className="mr-2 h-4 w-4"/>New Template
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-primary/10 shadow-sm bg-white p-3 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                placeholder="Search templates..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="h-9 pl-9 text-xs border-primary/5 bg-primary/[0.01]"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-muted-foreground hover:text-primary border border-primary/5">
                                        <Filter className="mr-1.5 h-3 w-3" />
                                        Cat: {categoryFilter}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48 rounded-xl">
                                    <DropdownMenuLabel className="text-[10px] uppercase opacity-40">Filter Category</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {categories.map(cat => (
                                        <DropdownMenuCheckboxItem 
                                            key={cat} 
                                            checked={categoryFilter === cat} 
                                            onCheckedChange={() => setCategoryFilter(cat)}
                                        >
                                            {cat}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold text-muted-foreground hover:text-primary border border-primary/5">
                                        <ShieldCheck className="mr-1.5 h-3 w-3" />
                                        Profile: {profileFilter}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48 rounded-xl">
                                    <DropdownMenuLabel className="text-[10px] uppercase opacity-40">Target Profile</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {profiles.map(p => (
                                        <DropdownMenuCheckboxItem 
                                            key={p} 
                                            checked={profileFilter === p} 
                                            onCheckedChange={() => setProfileFilter(p)}
                                        >
                                            {p}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="text-[9px] text-muted-foreground ml-auto whitespace-nowrap">{filteredTemplates.length} matches</span>
                        </div>
                    </Card>

                    <ScrollArea className="h-[600px] rounded-2xl border border-primary/5 bg-muted/5 p-2">
                        <div className="space-y-2">
                            {filteredTemplates.map(t => (
                                <Card 
                                    key={t.id} 
                                    className={cn(
                                        "cursor-pointer transition-all border-transparent shadow-none hover:bg-white hover:shadow-sm",
                                        editingId === t.id ? "bg-white shadow-md border-primary/20 ring-1 ring-primary/5" : "bg-white/50"
                                    )}
                                    onClick={() => handleEdit(t)}
                                >
                                    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                        <div className="min-w-0 pr-2">
                                            <p className="font-bold text-sm text-primary truncate">{t.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold opacity-40">{t.category}</p>
                                                <span className="text-primary/20 text-[10px]">•</span>
                                                <p className="text-[9px] text-primary/60 font-bold">{t.profileType || 'All'}</p>
                                            </div>
                                        </div>
                                        <Badge variant={t.isActive ? "eligible" : "secondary"} className="text-[8px] h-4 px-1 shrink-0">
                                            {t.isActive ? 'ACTIVE' : 'OFF'}
                                        </Badge>
                                    </CardHeader>
                                </Card>
                            ))}
                            {filteredTemplates.length === 0 && (
                                <div className="text-center py-10">
                                    <MessageSquare className="h-8 w-8 text-primary/5 mx-auto mb-2" />
                                    <p className="text-[10px] text-muted-foreground italic">No templates found.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <div className="lg:col-span-2">
                    {editingId ? (
                        <>
                        <Card className="border-primary/10 shadow-lg bg-white sticky top-4 overflow-hidden">
                            <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                        <Variable className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold tracking-tight">Template Engine</CardTitle>
                                        <CardDescription className="text-xs font-normal">Configure dynamic variables and content.</CardDescription>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="h-9 font-bold">Cancel</Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-9 w-9 p-0 border-primary/10"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-xl p-3">
                                            <DropdownMenuLabel className="text-red-600 font-bold">Danger Zone</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <p className="text-[10px] text-muted-foreground mb-3">Deleting this template will disable automated alerts linked to its ID.</p>
                                            <Button variant="destructive" size="sm" className="w-full font-bold" onClick={handleDelete} disabled={isSubmitting}>Confirm Delete</Button>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="h-9 font-bold shadow-md active:scale-95 transition-transform px-6">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Secure Template
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Template Identifier</Label>
                                        <Input 
                                            value={editData?.id || ''} 
                                            readOnly
                                            className="font-mono text-xs bg-muted/30"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Status</Label>
                                        <div className="flex items-center gap-3 h-10 px-3 rounded-lg border border-primary/5 bg-primary/[0.02]">
                                            <Checkbox 
                                                checked={editData?.isActive ?? true}
                                                onCheckedChange={checked => setEditData(prev => ({ ...prev, isActive: !!checked }))}
                                            />
                                            <span className="text-xs font-bold">{editData?.isActive ? 'Active & Ready' : 'Disabled (Hidden)'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Display Name</Label>
                                        <Input 
                                            value={editData?.name || ''} 
                                            onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                            className="font-bold border-primary/5 focus:border-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Category</Label>
                                        <Input 
                                            value={editData?.category || ''} 
                                            onChange={e => setEditData(prev => ({ ...prev, category: e.target.value as any }))}
                                            className="font-bold border-primary/5 focus:border-primary/20"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Target Profile Type</Label>
                                        <select 
                                            value={editData?.profileType || 'All'} 
                                            onChange={e => setEditData(prev => ({ ...prev, profileType: e.target.value as any }))}
                                            className="w-full h-10 px-3 rounded-lg border border-primary/5 bg-primary/[0.02] text-xs font-bold focus:ring-1 focus:ring-primary/20 outline-none"
                                        >
                                            {profiles.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Supported Channels</Label>
                                        <select 
                                            value={editData?.type || 'MultiChannel'} 
                                            onChange={e => setEditData(prev => ({ ...prev, type: e.target.value as any }))}
                                            className="w-full h-10 px-3 rounded-lg border border-primary/5 bg-primary/[0.02] text-xs font-bold focus:ring-1 focus:ring-primary/20 outline-none"
                                        >
                                            <option value="MultiChannel">MultiChannel (WA, TG, Mail)</option>
                                            <option value="WhatsApp">WhatsApp Only</option>
                                            <option value="Telegram">Telegram Only</option>
                                            <option value="Email">Email Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Subject (Email/Internal)</Label>
                                    <Input 
                                        value={editData?.subject || ''} 
                                        onChange={e => setEditData(prev => ({ ...prev, subject: e.target.value }))}
                                        className="font-normal border-primary/5"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Message Body (WhatsApp)</Label>
                                            <Badge variant="outline" className="text-[9px] bg-primary/5 border-primary/10 text-primary">Live Context</Badge>
                                        </div>
                                        
                                        <div className="p-4 rounded-2xl bg-primary/[0.03] border border-primary/5 space-y-3">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-primary opacity-60 uppercase tracking-tighter">
                                                <Variable className="h-3 w-3" /> Insert Dynamic Variable
                                            </div>
                                            <div className="flex gap-2 flex-wrap">
                                                {editData?.variables?.map(v => (
                                                    <Button 
                                                        key={v}
                                                        type="button"
                                                        variant="outline" 
                                                        size="sm"
                                                        className="h-8 px-3 rounded-xl border-primary/10 bg-white hover:bg-primary/5 hover:border-primary/20 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                                                        onClick={() => {
                                                            const body = editData.body || '';
                                                            setEditData(prev => ({ ...prev, body: body + ` {{${v}}}` }));
                                                            toast({ title: 'Variable Injected', description: `Added {{${v}}} to template body.` });
                                                        }}
                                                    >
                                                        <Plus className="h-3 w-3 mr-1.5 opacity-40" />
                                                        {v}
                                                    </Button>
                                                ))}
                                                {(!editData?.variables || editData.variables.length === 0) && (
                                                    <p className="text-[10px] text-muted-foreground italic">No variables registered for this template.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Textarea 
                                        value={editData?.body || ''} 
                                        onChange={e => setEditData(prev => ({ ...prev, body: e.target.value }))}
                                        rows={10}
                                        className="font-mono text-xs leading-relaxed border-primary/5 bg-primary/[0.01] focus:bg-white transition-all"
                                        placeholder="Use {{variable}} for dynamic content..."
                                    />
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground italic">
                                        <Info className="h-3 w-3" />
                                        <span>Use *text* for bold, _text_ for italics. Ensure all variables are correctly wrapped.</span>
                                    </div>
                                </div>

                                <div className="bg-primary/5 rounded-2xl p-6 space-y-4 border border-primary/5">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-[11px] font-bold text-primary flex items-center gap-2 uppercase tracking-tight">
                                            <ShieldCheck className="h-4 w-4" /> Variable Registry
                                        </h5>
                                        <p className="text-[10px] text-muted-foreground">Comma separated keys</p>
                                    </div>
                                    <Input 
                                        placeholder="e.g. name, id, amount, date, url"
                                        value={editData?.variables?.join(', ') || ''}
                                        onChange={e => setEditData(prev => ({ ...prev, variables: e.target.value.split(',').map(v => v.trim()).filter(v => v !== '') }))}
                                        className="text-xs font-mono h-10 bg-white border-primary/10 shadow-inner"
                                    />
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">Adding variables here makes them available as quick-insert badges in the editor above.</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Test Center */}
                        <Card className="border-primary/10 shadow-lg bg-white mt-6 overflow-hidden">
                            <CardHeader className="bg-indigo-500/5 border-b flex flex-row items-center justify-between p-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold tracking-tight">Test Center</CardTitle>
                                        <CardDescription className="text-xs font-normal">Validate templates with live user accounts.</CardDescription>
                                    </div>
                                </div>
                                <div className="flex bg-primary/5 p-1 rounded-lg">
                                    {(['Telegram', 'WhatsApp', 'Email'] as const).map(t => (
                                        <button 
                                            key={t}
                                            onClick={() => setTestTab(t)}
                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${testTab === t ? 'bg-white shadow-sm text-primary' : 'text-primary/40 hover:text-primary/60'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search test user by name, phone or email..."
                                            value={testSearchQuery}
                                            onChange={e => setTestSearchQuery(e.target.value)}
                                            className="pl-10 h-11 rounded-xl border-primary/10 bg-primary/[0.01]"
                                        />
                                        {isSearchingUsers && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                                    </div>

                                    {testUsers.length > 0 && !selectedTestUser && (
                                        <div className="p-2 rounded-xl border border-primary/5 bg-white shadow-xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                            {testUsers.map(user => (
                                                <button 
                                                    key={user.id}
                                                    onClick={() => {
                                                        setSelectedTestUser(user);
                                                        setTestSearchQuery('');
                                                        setTestUsers([]);
                                                    }}
                                                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 text-left transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                            <UserIcon className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-primary">{user.name}</p>
                                                            <p className="text-[9px] text-muted-foreground">{user.role} • {user.phone || user.email || 'No contact'}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[8px] font-bold uppercase">{user.id.slice(0, 4)}</Badge>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {selectedTestUser && (
                                        <div className="p-5 rounded-2xl border-2 border-indigo-500/20 bg-indigo-50/30 animate-in zoom-in-95">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-700">
                                                        <UserIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-primary">{selectedTestUser.name}</h4>
                                                        <Badge className="bg-indigo-500 text-white text-[9px] h-4">{selectedTestUser.role}</Badge>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setSelectedTestUser(null)} className="h-8 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">Change User</Button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className={`p-3 rounded-xl border ${testTab === 'Telegram' ? 'border-indigo-500/30 bg-white' : 'border-primary/5 bg-primary/[0.02] opacity-50'} transition-all`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Send className="h-3.5 w-3.5 text-sky-500" />
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Telegram</span>
                                                    </div>
                                                    <p className="text-[11px] font-mono truncate">{selectedTestUser.telegramChatId ? `ID: ${selectedTestUser.telegramChatId}` : 'Not Linked'}</p>
                                                    {selectedTestUser.telegramChatId ? <CheckCircle2 className="h-3 w-3 text-green-500 mt-1" /> : <AlertCircle className="h-3 w-3 text-amber-500 mt-1" />}
                                                </div>

                                                <div className={`p-3 rounded-xl border ${testTab === 'WhatsApp' ? 'border-indigo-500/30 bg-white' : 'border-primary/5 bg-primary/[0.02] opacity-50'} transition-all`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Smartphone className="h-3.5 w-3.5 text-green-500" />
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">WhatsApp</span>
                                                    </div>
                                                    <p className="text-[11px] font-mono truncate">{selectedTestUser.phone ? `+91 ${selectedTestUser.phone}` : 'No Phone'}</p>
                                                    {selectedTestUser.phone ? <CheckCircle2 className="h-3 w-3 text-green-500 mt-1" /> : <AlertCircle className="h-3 w-3 text-amber-500 mt-1" />}
                                                </div>

                                                <div className={`p-3 rounded-xl border ${testTab === 'Email' ? 'border-indigo-500/30 bg-white' : 'border-primary/5 bg-primary/[0.02] opacity-50'} transition-all`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Mail className="h-3.5 w-3.5 text-indigo-500" />
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Email</span>
                                                    </div>
                                                    <p className="text-[11px] font-mono truncate">{selectedTestUser.email && !selectedTestUser.email.includes('@donor.demo.local') ? selectedTestUser.email : 'No Email'}</p>
                                                    {selectedTestUser.email && !selectedTestUser.email.includes('@donor.demo.local') ? <CheckCircle2 className="h-3 w-3 text-green-500 mt-1" /> : <AlertCircle className="h-3 w-3 text-amber-500 mt-1" />}
                                                </div>
                                            </div>

                                            <Button 
                                                className="w-full mt-6 font-bold shadow-lg h-11 bg-indigo-600 hover:bg-indigo-700 transition-all"
                                                onClick={() => handleChannelTest(testTab)}
                                                disabled={isTestingChannel !== null}
                                            >
                                                {isTestingChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                                Dispatch Live {testTab} Test
                                            </Button>
                                        </div>
                                    )}

                                    {!selectedTestUser && (
                                        <div className="h-40 border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center text-primary/40">
                                            <UserIcon className="h-8 w-8 mb-2 opacity-20" />
                                            <p className="text-[11px] font-bold">Search and select a user to begin diagnostic testing.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 bg-muted/5 border-2 border-dashed rounded-[32px] border-primary/5 opacity-60">
                            <div className="p-6 rounded-full bg-white shadow-sm mb-6 animate-pulse">
                                <Variable className="h-12 w-12 text-primary/10" />
                            </div>
                            <h3 className="text-xl font-bold text-primary tracking-tight">Template Engine Idle</h3>
                            <p className="text-sm text-muted-foreground max-w-xs text-center mt-2">Select a notification template from the registry to begin editing its dynamic content.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
