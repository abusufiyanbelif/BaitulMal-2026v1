'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
    useFirestore, 
    useDoc, 
    errorEmitter, 
    FirestorePermissionError, 
    useCollection, 
    useMemoFirebase, 
    useStorage, 
    useAuth, 
    collection, 
    doc,
    type DocumentReference,
    updateDoc,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL
} from '@/firebase';
import { useSession } from '@/hooks/use-session';
import { useBranding } from '@/hooks/use-branding';
import { usePaymentSettings } from '@/hooks/use-payment-settings';
import type { Lead, Beneficiary, Donation, CampaignDocument, DonationCategory, Campaign } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
    ArrowLeft, 
    Edit, 
    Save, 
    Share2, 
    Download, 
    UploadCloud, 
    Trash2, 
    File, 
    Target,
    Users,
    Gift,
    Hourglass,
    TrendingUp,
    PieChart as PieChartIcon,
    ZoomIn,
    ZoomOut,
    RotateCw,
    RefreshCw,
    ImageIcon,
    GraduationCap,
    HeartPulse,
    Info,
    HandHelping,
    ShieldCheck,
    LifeBuoy,
    ChevronRight,
    History,
    Clock,
    Calendar,
    HeartHandshake,
    Check
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDownloadAs } from '@/hooks/use-download-as';
import { Label } from '@/components/ui/label';
import { cn, getNestedValue, getImageSrc, serializeForAction, generateChanges } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShareDialog } from '@/components/share-dialog';
import { donationCategories, leadPurposesConfig, leadSeriousnessLevels, educationDegrees, educationYears, educationSemesters, priorityLevels } from '@/lib/modules';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileUploader } from '@/components/file-uploader';
import { Switch } from '@/components/ui/switch';
import { BrandedLoader } from '@/components/branded-loader';
import Resizer from 'react-image-file-resizer';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import type { ChartConfig } from '@/components/ui/chart';
import { recalculateLeadGoalAction } from '../../actions';
import { PendingUpdateWarning } from '@/components/pending-update-warning';
import { VerificationRequestDialog } from '@/components/verification-request-dialog';
import { checkPendingVerificationAction, cleanupPendingVerificationsAction } from '@/app/verifications/actions';
import { recordAuditLogAction } from '@/app/audit/actions';
import { notifyLeadAction } from '@/app/messages/actions';
import { AuditHistory } from '@/components/audit-history';
import { getDefaultImage, defaultInstitutionalAssets } from '@/lib/default-images';
import type { PendingVerification } from '@/lib/types';

const donationCategoryChartConfig = {
    Fitra: { label: "Fitra", color: "hsl(var(--chart-3))" },
    Zakat: { label: "Zakat", color: "hsl(var(--chart-1))" },
    Sadaqah: { label: "Sadaqah", color: "hsl(var(--chart-2))" },
    Fidiya: { label: "Fidiya", color: "hsl(var(--chart-7))" },
    Lillah: { label: "Lillah", color: "hsl(var(--chart-4))" },
    Interest: { label: "Interest", color: "hsl(var(--chart-5))" },
    Loan: { label: "Loan", color: "hsl(var(--chart-6))" },
    'Monthly Contribution': { label: "Monthly Contribution", color: "hsl(var(--chart-8))" },
} satisfies ChartConfig;

const donationPaymentTypeChartConfig = {
    Cash: { label: "Cash", color: "hsl(var(--chart-1))" },
    'Online Payment': { label: "Online Payment", color: "hsl(var(--chart-2))" },
    Check: { label: "Check", color: "hsl(var(--chart-5))" },
    Other: { label: "Other", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

export default function LeadSummaryPage() {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const leadId = params?.leadId as string;
    const firestore = useFirestore();
    const storage = useStorage();
    const auth = useAuth();
    const { toast } = useToast();
    const { userProfile, isLoading: isProfileLoading } = useSession();
    const { brandingSettings, isLoading: isBrandingLoading } = useBranding();
    const { paymentSettings, isLoading: isPaymentLoading } = usePaymentSettings();
    const { download } = useDownloadAs();

    const [editMode, setEditMode] = useState(false);
    const [editableLead, setEditableLead] = useState<Partial<Lead>>({});
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isImageDeleted, setIsImageDeleted] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    
    const [newDocuments, setNewDocuments] = useState<File[]>([]);
    const [existingDocuments, setExistingDocuments] = useState<CampaignDocument[]>([]);
    const [shopPhonePrefix, setShopPhonePrefix] = useState('+91');

    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [shareDialogData, setShareDialogData] = useState({ title: '', text: '', url: '' });

    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [imageToView, setImageToView] = useState<{url: string, name: string} | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const [pendingSaveData, setPendingSaveData] = useState<any>(null);
    const [existingPendingRequest, setExistingPendingRequest] = useState<PendingVerification | null>(null);
    const [selectedDefaultImageUrl, setSelectedDefaultImageUrl] = useState<string | null>(null);

    const summaryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!leadId) return;
        checkPendingVerificationAction(leadId).then(setExistingPendingRequest);
    }, [leadId, editMode]);

    const leadDocRef = useMemoFirebase(() => (firestore && leadId) ? doc(firestore, 'leads', leadId) as DocumentReference<Lead> : null, [firestore, leadId]);
    const beneficiariesCollectionRef = useMemoFirebase(() => (firestore && leadId) ? collection(firestore, `leads/${leadId}/beneficiaries`) : null, [firestore, leadId]);
    const allDonationsCollectionRef = useMemoFirebase(() => (firestore) ? collection(firestore, 'donations') : null, [firestore]);
    const allCampaignsRef = useMemoFirebase(() => firestore ? collection(firestore, 'campaigns') : null, [firestore]);
    const allLeadsRef = useMemoFirebase(() => firestore ? collection(firestore, 'leads') : null, [firestore]);

    const { data: lead, isLoading: isLeadLoading, forceRefetch: forceRefetchLead } = useDoc<Lead>(leadDocRef);
    const { data: beneficiaries, isLoading: areBeneficiariesLoading } = useCollection<Beneficiary>(beneficiariesCollectionRef);
    const { data: allDonations, isLoading: areDonationsLoading } = useCollection<Donation>(allDonationsCollectionRef);
    const { data: globalCampaigns } = useCollection<Campaign>(allCampaignsRef);
    const { data: globalLeads } = useCollection<Lead>(allLeadsRef);

    const galleryImages = useMemo(() => {
        const urls = new Set<string>();
        defaultInstitutionalAssets.forEach(a => urls.add(a.url));
        if (globalCampaigns) globalCampaigns.forEach(c => { if (c.imageUrl && !c.imageUrl.startsWith('data:')) urls.add(c.imageUrl); });
        if (globalLeads) globalLeads.forEach(l => { if (l.imageUrl && !l.imageUrl.startsWith('data:')) urls.add(l.imageUrl); });
        return Array.from(urls);
    }, [globalCampaigns, globalLeads]);
    
    const visibilityRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_visibility') : null, [firestore]);
    const { data: visibilitySettings } = useDoc<any>(visibilityRef);

    const configRef = useMemoFirebase(() => (firestore) ? doc(firestore, 'settings', 'lead_config') : null, [firestore]);
    const { data: configSettings } = useDoc<any>(configRef);

    const effectiveVerificationMode = useMemo(() => {
        const rawMode = configSettings?.verificationMode || (configSettings?.isVerificationRequired ? 'Mandatory' : 'Disabled');
        // Per user request: Active or Completed records make approval optional (bypassable)
        if (rawMode !== 'Disabled' && rawMode !== 'disabled' && (lead?.status === 'Active' || lead?.status === 'Completed')) {
            return 'Optional';
        }
        return rawMode;
    }, [configSettings, lead?.status]);

    useEffect(() => { setIsClient(true); }, []);

    const isRationInitiative = useMemo(() => {
        return lead?.purpose === 'Relief' && lead?.category === 'Ration Kit';
    }, [lead]);

    const itemGivenLabel = useMemo(() => isRationInitiative ? 'Kits Given' : 'Assistance Given', [isRationInitiative]);
    const itemPendingLabel = useMemo(() => isRationInitiative ? 'Pending Kits' : 'Pending Support', [isRationInitiative]);

    const beneficiaryGroups = useMemo(() => {
        if (!lead || !beneficiaries) return [];
        const categories = (lead.itemCategories || []).filter(c => c.name !== 'Item Price List');
        return categories.map(cat => {
            const count = beneficiaries.filter(b => b.itemCategoryId === cat.id || (!b.itemCategoryId && cat.id === 'general')).length;
            const kitAmount = cat.items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            
            let displayName = cat.name;
            if (isRationInitiative) {
                if (cat.minMembers === 1 && cat.maxMembers === 1) displayName = `Member (1)`;
                else if (cat.minMembers !== undefined && cat.maxMembers !== undefined) displayName = `Members (${cat.minMembers}-${cat.maxMembers})`;
            }

            return { id: cat.id, name: displayName, count, kitAmount, totalAmount: count * kitAmount };
        });
    }, [lead, beneficiaries, isRationInitiative]);

    const calculatedRequirementTotal = useMemo(() => {
        if (isRationInitiative) {
            return beneficiaryGroups.reduce((sum, g) => sum + g.totalAmount, 0);
        } else {
            const singleUnitTotal = lead?.itemCategories?.[0]?.items.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity) || 0), 0) || 0;
            return singleUnitTotal * (beneficiaries?.length || 0);
        }
    }, [beneficiaryGroups, isRationInitiative, lead, beneficiaries]);

    const fundingData = useMemo(() => {
        if (!allDonations || !lead || !beneficiaries) return null;

        const donations = allDonations.filter(d => 
            d.linkSplit?.some(link => link.linkId === lead.id || link.linkId === `lead_${lead.id}`)
        );
        const verifiedDonationsList = donations.filter(d => d.status === 'Verified');
    
        const amountsByCategory: Record<DonationCategory, number> = donationCategories.reduce((acc, cat) => ({...acc, [cat]: 0}), {} as Record<DonationCategory, number>);
        const paymentTypeStats: Record<string, { count: number, amount: number }> = {};
        let zakatForGoalAmount = 0;

        verifiedDonationsList.forEach(d => {
            const leadAllocation = d.linkSplit?.find(link => link.linkId === lead.id || link.linkId === `lead_${lead.id}`);
            if (!leadAllocation) return;

            const paymentType = d.donationType || 'Other';
            if (!paymentTypeStats[paymentType]) {
                paymentTypeStats[paymentType] = { count: 0, amount: 0 };
            }
            paymentTypeStats[paymentType].count += 1;
            paymentTypeStats[paymentType].amount += leadAllocation.amount;

            const totalDonationAmount = d.amount > 0 ? d.amount : 1;
            const allocationProportion = leadAllocation.amount / totalDonationAmount;
            const splits = d.typeSplit && d.typeSplit.length > 0 ? d.typeSplit : (d.type ? [{ category: d.type as DonationCategory, amount: d.amount, forFundraising: true }] : []);
            splits.forEach(split => {
                const category = (split.category as any) === 'General' || (split.category as any) === 'Sadqa' ? 'Sadaqah' : split.category;
                if (amountsByCategory.hasOwnProperty(category)) {
                    const allocatedAmount = split.amount * allocationProportion;
                    amountsByCategory[category as DonationCategory] += allocatedAmount;
                    
                    const isForFundraising = category !== 'Zakat' || split.forFundraising !== false;
                    if (category === 'Zakat' && isForFundraising) zakatForGoalAmount += allocatedAmount;
                }
            });
        });
        
        const zakatAllocated = beneficiaries.filter(b => b.isEligibleForZakat && b.zakatAllocation).reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        const zakatGiven = beneficiaries.filter(b => b.isEligibleForZakat && b.zakatAllocation && b.status === 'Given').reduce((sum, b) => sum + (b.zakatAllocation || 0), 0);
        const zakatPending = zakatAllocated - zakatGiven;
        const totalZakatBalance = (amountsByCategory.Zakat || 0) - zakatAllocated;

        const zakatSurplus = Math.max(0, zakatForGoalAmount - zakatAllocated);
        
        const allowedTypes = lead.allowedDonationTypes && lead.allowedDonationTypes.length > 0
            ? lead.allowedDonationTypes
            : [...donationCategories];

        const totalCollectedForGoal = Object.entries(amountsByCategory)
            .filter(([category]) => allowedTypes.some(t => t.toLowerCase() === category.toLowerCase()))
            .reduce((sum, [category, amount]) => {
                if (category === 'Zakat') return sum + zakatForGoalAmount;
                return sum + amount;
            }, 0);

        const targetAmount = calculatedRequirementTotal > 0 ? calculatedRequirementTotal : (lead.targetAmount || 0);

        return {
            totalCollectedForGoal,
            fundingProgress: targetAmount > 0 ? (totalCollectedForGoal / targetAmount) * 100 : 0,
            targetAmount,
            amountsByCategory,
            paymentTypeStats,
            zakatAllocated, zakatGiven, zakatPending, zakatSurplus, totalZakatBalance,
            totalBeneficiaries: beneficiaries.length,
            beneficiariesGiven: beneficiaries.filter(b => b.status === 'Given').length,
            beneficiariesPending: beneficiaries.length - beneficiaries.filter(b => b.status === 'Given').length,
            grandTotal: Object.values(amountsByCategory).reduce((sum, val) => sum + val, 0)
        };
    }, [allDonations, lead, beneficiaries, calculatedRequirementTotal]);

    const chartDataValues = useMemo(() => {
        return fundingData?.amountsByCategory ? Object.entries(fundingData.amountsByCategory).map(([name, value]) => ({ 
            name, value, fill: `var(--color-${name.replace(/\s+/g, '')})` 
        })) : [];
    }, [fundingData]);

    const paymentTypeChartData = useMemo(() => {
        if (!fundingData?.paymentTypeStats) return [];
        return Object.entries(fundingData.paymentTypeStats).map(([name, stats]) => ({
            name, 
            value: stats.amount, 
            count: stats.count,
            fill: `var(--color-${name.replace(/\s+/g, '')})`
        }));
    }, [fundingData]);

    const canReadSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.read', false);
    const canUpdateSummary = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.summary.update', false);
    const canReadBeneficiaries = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.beneficiaries.read', false);
    const canReadDonations = userProfile?.role === 'Admin' || !!getNestedValue(userProfile, 'permissions.leads-members.donations.read', false);
    
    const publicDocuments = lead?.documents?.filter(d => d.isPublic) || [];
    const FallbackIcon = lead?.purpose === 'Education' ? GraduationCap : lead?.purpose === 'Medical' ? HeartPulse : lead?.purpose === 'Relief' ? LifeBuoy : lead?.purpose === 'Other' ? Info : HandHelping;

    useEffect(() => {
        if (lead && !editMode) {
            setEditableLead({
                name: lead.name || '',
                description: lead.description || '',
                startDate: lead.startDate || '',
                endDate: lead.endDate || '',
                category: lead.category || '',
                purpose: lead.purpose || 'Other',
                status: lead.status || 'Active',
                priority: lead.priority || 'Low',
                targetAmount: lead.targetAmount || 0,
                requiredAmount: lead.requiredAmount || 0,
                authenticityStatus: lead.authenticityStatus || 'Pending Verification',
                publicVisibility: lead.publicVisibility || 'Hold',
                allowedDonationTypes: lead.allowedDonationTypes || [...donationCategories],
                imageUrl: lead.imageUrl || '',
                imageUrlFilename: lead.imageUrlFilename || '',
                purposeDetails: lead.purposeDetails || '',
                categoryDetails: lead.categoryDetails || '',
                notes: lead.notes || '',
                priceDate: lead.priceDate || '',
                shopName: lead.shopName || '',
                shopContact: lead.shopContact || '',
                shopAddress: lead.shopAddress || '',
                degree: lead.degree || '',
                year: lead.year || '',
                semester: lead.semester || '',
                diseaseIdentified: lead.diseaseIdentified || '',
                diseaseStage: lead.diseaseStage || '',
                seriousness: lead.seriousness || null,
                itemCategories: lead.itemCategories || [],
            });
            if (lead.shopContact && lead.shopContact.startsWith('+')) {
                const match = lead.shopContact.match(/^(\+\d+)/);
                if (match) {
                    setShopPhonePrefix(match[1]);
                }
            }
            setExistingDocuments(lead.documents || []);
            setImagePreview(lead.imageUrl || null);
            setIsImageDeleted(false);
            setImageFile(null);
            setNewDocuments([]);
            setSelectedDefaultImageUrl(null);
        }
    }, [lead, editMode]);

    const purpose = editableLead.purpose;
    // Handle default image suggestions when purpose changes
    useEffect(() => {
        // Only suggest a default image if there's no existing image and we're in edit mode
        if (editMode && purpose && !editableLead.imageUrl && !imagePreview) {
            const suggested = getDefaultImage(purpose);
            setSelectedDefaultImageUrl(suggested);
        }
    }, [purpose, editMode, editableLead.imageUrl, imagePreview]);

    const handleFieldChange = (field: keyof Lead, value: any) => {
        setEditableLead(p => (p ? { ...p, [field]: value } : null));
    };

    const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => { setImagePreview(reader.result as string); };
            reader.readAsDataURL(file);
            setIsImageDeleted(false);
        }
    };
    
    const handleRemoveImage = () => { 
        setImageFile(null); 
        setImagePreview(null); 
        setSelectedDefaultImageUrl(null);
        setIsImageDeleted(true); 
    };

    const handleRemoveExistingDocument = (urlToRemove: string) => {
        setExistingDocuments(prev => prev.filter(doc => doc.url !== urlToRemove));
    };

    const handleToggleDocumentPublic = (urlToToggle: string) => {
        setExistingDocuments(prev => prev.map(doc => doc.url === urlToToggle ? { ...doc, isPublic: !doc.isPublic } : doc));
    };

    const quickToggleDocumentPublic = async (docToToggle: CampaignDocument) => {
        if (!leadDocRef || !lead?.documents) return;
        const newDocs = lead.documents.map(doc => doc.url === docToToggle.url ? { ...doc, isPublic: !doc.isPublic } : doc);
        try {
            await updateDoc(leadDocRef, { documents: newDocs, updatedAt: serverTimestamp() });
            toast({ title: "Visibility Updated", variant: "success" });
        } catch (serverError: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: leadDocRef.path, operation: 'update', requestResourceData: { documents: newDocs } }));
        }
    };

    const isVisible = (key: string) => {
        return visibilitySettings?.[`member_${key}`] !== false;
    };

    const handleSave = async () => {
        if (!leadDocRef || !userProfile || !storage) return;
        const hasFileToUpload = !!imageFile || newDocuments.length > 0;
        if (hasFileToUpload && !auth?.currentUser) {
            toast({ title: "Verification Error", description: "Authorization Session Expired.", variant: "destructive" });
            return;
        }
        setIsSubmitting(true);
        let imageUrl = editableLead.imageUrl || '';
        let imageUrlFilename = editableLead.imageUrlFilename || '';

        // Priority 1: New File Upload
        if (imageFile) {
            try {
                const resizedBlob = await new Promise<Blob>((resolve) => {
                    (Resizer as any).imageFileResizer(imageFile, 1024, 1024, 'PNG', 85, 0, (blob: any) => resolve(blob as Blob), 'blob');
                });
                const filePath = `leads/${leadId}/background.png`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, resizedBlob);
                imageUrl = await getDownloadURL(fileRef);
                const dateStr = new Date().toISOString().split('T')[0];
                imageUrlFilename = `lead_${editableLead.name?.replace(/\s+/g, '_')}_${dateStr}.png`;
            } catch (uploadError) {
                toast({ title: 'Image Upload Failed', variant: 'destructive'});
                setIsSubmitting(false);
                return;
            }
        } 
        // Priority 2: Explicit Deletion (User clicked "Remove")
        else if (isImageDeleted) {
            imageUrl = '';
            imageUrlFilename = '';
        }
        // Priority 3: Gallery Selection (User picked an existing image)
        else if (selectedDefaultImageUrl) {
            imageUrl = selectedDefaultImageUrl;
            imageUrlFilename = 'institutional_default.png';
        }
        // Priority 4: Keep Existing (Handled by the initial let assignments)
        const documentUploadPromises = newDocuments.map(async (file) => {
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const fileRef = storageRef(storage, `leads/${leadId}/documents/${safeFileName}`);
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            return { name: file.name, url, uploadedAt: new Date().toISOString(), isPublic: false };
        });
        const uploadedDocuments = await Promise.all(documentUploadPromises);
        const finalDocuments = [...existingDocuments, ...uploadedDocuments];
        const saveData: Partial<Lead> = {
            ...editableLead,
            requiredAmount: Number(editableLead.requiredAmount) || 0,
            targetAmount: Number(editableLead.targetAmount) || 0,
            imageUrl: imageUrl,
            imageUrlFilename: imageUrlFilename,
            documents: finalDocuments,
            updatedAt: serverTimestamp(),
            updatedById: userProfile.id,
            updatedByName: userProfile.name,
        };
        setPendingSaveData(saveData);

        const isApprovalRequired = effectiveVerificationMode !== 'Disabled' && effectiveVerificationMode !== 'disabled';

        if (isApprovalRequired) {
            setIsVerificationDialogOpen(true);
        } else {
            // Apply changes directly
            if (leadId && firestore && lead) {
                // Calculate changed fields for notification
                const changedFields = Object.keys(saveData).filter(key => 
                    JSON.stringify((saveData as any)[key]) !== JSON.stringify((lead as any)[key])
                ).map(key => key.charAt(0).toUpperCase() + key.slice(1));
                
                await updateDoc(doc(firestore, 'leads', leadId), saveData);
                await notifyLeadAction(leadId, 'lead_updated', {
                    actionType: 'Direct Summary Update',
                    summary: changedFields.length > 0 ? `Updated: ${changedFields.join(', ')}` : 'Manual record re-save'
                });
                toast({ title: 'Summary Updated', description: 'Changes applied successfully.', variant: 'success' });
                setEditMode(false);
                forceRefetchLead();
            }
        }
        setIsSubmitting(false);
    };
    
    const handleDownload = (format: 'png' | 'pdf') => {
        download(format, { contentRef: summaryRef, documentTitle: `Appeal Summary: ${lead?.name}`, documentName: `lead-summary-${leadId}`, brandingSettings, paymentSettings });
    };

    const handleViewImage = (url: string, name: string) => {
        setImageToView({ url, name });
        setZoom(1);
        setRotation(0);
        setIsImageViewerOpen(true);
    };

    const isLoadingPage = isLeadLoading || areBeneficiariesLoading || areDonationsLoading || isProfileLoading || isBrandingLoading || isPaymentLoading;

    if (isLoadingPage) return <BrandedLoader message="Initializing Appeal Summary..." />;

    if (!lead) return <p className="text-center mt-20 text-primary font-bold">Appeal Record Not Found.</p>;

    return (
        <main className="container mx-auto p-4 md:p-8 text-primary font-normal overflow-hidden">
             {isSubmitting && <BrandedLoader message="Securing Appeal Changes..." />}
             <div className="mb-4 transition-all duration-300 hover:-translate-x-1"><Button variant="outline" asChild className="font-bold border-primary/20 transition-transform active:scale-95 text-primary">
                <Link href="/leads-members"><ArrowLeft className="mr-2 h-4 w-4" /> All Help Requests</Link></Button>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2 animate-fade-in-up">
                 <div className="space-y-1">
                    {editMode ? ( <Input id="name" value={editableLead.name || ''} onChange={(e) => handleFieldChange('name', e.target.value)} className="text-3xl font-bold h-auto p-0 border-0 shadow-none focus-visible:ring-0 text-primary" /> ) : ( <h1 className="text-3xl font-bold text-primary tracking-tight">{lead?.name}</h1> )}
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold tracking-tight capitalize">{lead?.status}</Badge>
                        <Badge variant={lead?.authenticityStatus === 'Verified' ? 'eligible' : 'outline'} className="text-[10px] font-bold flex items-center gap-1 capitalize">
                            <ShieldCheck className="h-3 w-3" />
                            {lead?.authenticityStatus}
                        </Badge>
                        <Badge variant={lead?.priority === 'Urgent' ? 'destructive' : 'outline'} className={cn("text-[10px] font-bold capitalize", lead?.priority === 'Urgent' && "animate-in fade-in slide-in-from-left")}>
                            {lead?.priority || 'Low'} Priority
                        </Badge>
                    </div>
                </div>
                <div className="flex gap-2">
                    {!editMode && (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="outline" className="font-bold active:scale-95 transition-all duration-300 hover:shadow-md border-primary/20 text-primary">
                                        <Download className="mr-2 h-4 w-4" /> Download
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">
                                    <DropdownMenuItem onClick={() => handleDownload('png')} className="font-normal text-primary">
                                        Image (PNG)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDownload('pdf')} className="font-normal text-primary">
                                        PDF File
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button 
                                onClick={() => { 
                                    if(lead && fundingData) {
                                        const richText = `*Appeal: ${lead.name}*\n` +
                                            `🆔 ID: ${lead.id}\n` +
                                            `🎯 Purpose: ${lead.purpose} (${lead.category})\n` +
                                            `💰 Target Goal: ₹${fundingData.targetAmount.toLocaleString('en-IN')}\n` +
                                            `📈 Collected: ₹${fundingData.totalCollectedForGoal.toLocaleString('en-IN')}\n` +
                                            `🗓️ Period: ${lead.startDate || 'N/A'} to ${lead.endDate || 'N/A'}\n\n` +
                                            `${lead.description?.substring(0, 500) || 'Help us make a difference.'}`;
                                            
                                        setShareDialogData({ 
                                            title: `Appeal: ${lead.name}`, 
                                            text: richText, 
                                            url: window.location.origin + `/leads-public/${leadId}/summary` 
                                        }); 
                                        setIsShareDialogOpen(true); 
                                    } 
                                }} 
                                variant="outline" 
                                className="font-bold active:scale-95 transition-all duration-300 hover:shadow-md border-primary/20 text-primary"
                            >
                                <Share2 className="mr-2 h-4 w-4" /> Share
                            </Button>
                        </>
                    )}
                    {canUpdateSummary && userProfile && (
                        <>
                            {!editMode && (
                                <Button 
                                    variant="outline" 
                                    onClick={async () => {
                                        setIsSubmitting(true);
                                        try {
                                            const res = await recalculateLeadGoalAction(leadId as string);
                                            toast({ title: res.success ? 'Success' : 'Error', description: res.message, variant: res.success ? 'success' : 'destructive' });
                                            if (res.success) forceRefetchLead();
                                        } finally {
                                            setIsSubmitting(false);
                                        }
                                    }}
                                    className="font-bold border-primary/20 text-primary hover:bg-primary/5"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" /> Recalculate Goal
                                </Button>
                            )}
                            { !editMode ? ( 
                                <Button 
                                    onClick={() => setEditMode(true)} 
                                    disabled={!!existingPendingRequest && userProfile?.role !== 'Admin'}
                                    className={cn(
                                        "font-bold shadow-md active:scale-95 transition-all duration-300 hover:shadow-xl",
                                        (existingPendingRequest && userProfile?.role !== 'Admin') ? "bg-muted text-muted-foreground" : "bg-primary hover:bg-primary/90 text-white"
                                    )}
                                >
                                    <Edit className="mr-2 h-4 w-4" /> 
                                    {existingPendingRequest ? "Approval Pending" : "Edit Details"}
                                </Button> 
                            ) : ( 
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setEditMode(false)} className="font-bold border-primary/20 text-primary transition-transform">Cancel</Button>
                                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white font-bold shadow-md active:scale-95 transition-all duration-300 hover:shadow-xl"><Save className="mr-2 h-4 w-4" /> Secure Changes</Button>
                                </div>
                            ) }
                        </>
                    )}
                </div>
            </div>

            <div className="mb-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <ScrollArea className="w-full">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full bg-transparent p-0 border-b border-primary/10 pb-4">
                      {canReadSummary && (
                        <Link href={`/leads-members/${leadId}/summary`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname === `/leads-members/${leadId}/summary` ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Summary</Link>
                      )}
                      <Link href={`/leads-members/${leadId}`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-200 border border-primary/10 active:scale-95", pathname === `/leads-members/${leadId}` ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Item List</Link>
                      {canReadBeneficiaries && ( <Link href={`/leads-members/${leadId}/beneficiaries`} className={cn("inline-flex items-center justify-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/beneficiaries`) ? "bg-primary text-white shadow-md" : "text-muted-foreground font-bold hover:bg-primary/10 hover:text-primary")}>Beneficiaries</Link> )}
                      {canReadDonations && ( <Link href={`/leads-members/${leadId}/donations`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.startsWith(`/leads-members/${leadId}/donations`) ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Donation Log</Link> )}
                      <Link href={`/leads-members/${leadId}/audit`} className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-bold transition-all duration-300 border border-primary/10 active:scale-95", pathname.endsWith('/audit') ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:bg-primary/10 hover:text-primary")}>Audit Trail</Link>
                  </div>
                  <ScrollBar orientation="horizontal" className="hidden" />
              </ScrollArea>
            </div>

            <div className="mb-6">
                <PendingUpdateWarning targetId={leadId} module="leads" />
            </div>

            <div className="space-y-6" ref={summaryRef}>
                <Card className="animate-fade-in-up shadow-md border-primary/10 bg-white transition-all duration-300 hover:shadow-xl">
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary tracking-tight capitalize">About This Request</CardTitle></CardHeader>
                        <CardContent className="space-y-4 pt-6 text-foreground font-normal">
                            {editMode ? (
                                <div className="space-y-6 font-normal animate-fade-in-zoom">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize opacity-60">Upload Image</Label>
                                        <Input id="imageFile" type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                                        <label htmlFor="imageFile" className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary transition-all duration-300 group border-primary/20 overflow-hidden">
                                            {imagePreview || selectedDefaultImageUrl ? ( 
                                                <>
                                                    <Image src={getImageSrc(imagePreview || selectedDefaultImageUrl!)} alt="Preview" fill sizes="100vw" className="object-cover rounded-lg transition-transform duration-700 group-hover:scale-105" />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                                    
                                                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 transition-all duration-300 hover:scale-110 active:scale-90 shadow-lg z-20" onClick={(e) => { e.preventDefault(); handleRemoveImage(); }}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>

                                                    <div className="absolute bottom-2 left-2 right-2 text-center text-white/80 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none drop-shadow-md">
                                                        Click To Upload Custom Background
                                                    </div>
                                                </> 
                                            ) : ( 
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6 transition-transform group-hover:scale-105">
                                                    <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground group-hover:text-primary" />
                                                    <p className="mb-2 text-sm text-center text-muted-foreground font-bold"><span className="text-primary">Click To Upload</span></p>
                                                </div> 
                                            )}
                                        </label>
                                        
                                        {/* Global Asset Gallery */}
                                        <div className="pt-2 space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Global Image Gallery</Label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                {galleryImages.map((url, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            handleRemoveImage();
                                                            setSelectedDefaultImageUrl(url);
                                                        }}
                                                        className={cn(
                                                            "relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all",
                                                            selectedDefaultImageUrl === url ? "border-primary ring-2 ring-primary/20 scale-95" : "border-transparent opacity-60 hover:opacity-100"
                                                        )}
                                                    >
                                                        <Image src={getImageSrc(url)} alt={`Gallery Image ${idx}`} fill sizes="96px" className="object-cover" />
                                                        {selectedDefaultImageUrl === url && (
                                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                <Check className="h-6 w-6 text-white" />
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Type of Help</Label>
                                            <Select value={editableLead.purpose} onValueChange={(val) => handleFieldChange('purpose', val)}>
                                                <SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger>
                                                <SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">{leadPurposesConfig.map(p => <SelectItem key={p.id} value={p.id} className="font-normal">{p.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Priority Level</Label>
                                            <Select value={editableLead.priority} onValueChange={(val) => handleFieldChange('priority', val)}>
                                                <SelectTrigger className="font-bold text-primary border-primary/10"><SelectValue/></SelectTrigger>
                                                <SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">
                                                    {priorityLevels.map(p => <SelectItem key={p} value={p} className="font-normal">{p}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Request Status</Label>
                                            <Select value={editableLead.status} onValueChange={(value) => handleFieldChange('status', value)}>
                                                <SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger>
                                                <SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">
                                                    <SelectItem value="Upcoming" className="font-normal">Upcoming</SelectItem>
                                                    <SelectItem value="Active" className="font-bold text-primary">Active</SelectItem>
                                                    <SelectItem value="Completed" className="font-normal">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Check Status</Label>
                                            <Select value={editableLead.authenticityStatus} onValueChange={(value) => handleFieldChange('authenticityStatus', value)}>
                                                <SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger>
                                                <SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">
                                                    <SelectItem value="Pending Verification" className="font-normal">Pending</SelectItem>
                                                    <SelectItem value="Verified" className="font-bold text-primary">Verified</SelectItem>
                                                    <SelectItem value="On Hold" className="font-normal">On Hold</SelectItem>
                                                    <SelectItem value="Rejected" className="font-bold text-destructive">Rejected</SelectItem>
                                                    <SelectItem value="Need More Details" className="font-normal">Needs Details</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Show on Website</Label>
                                            <Select value={editableLead.publicVisibility} onValueChange={(value) => handleFieldChange('publicVisibility', value)}>
                                                <SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger>
                                                <SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">
                                                    <SelectItem value="Hold" className="font-normal">Hold (Private)</SelectItem>
                                                    <SelectItem value="Ready to Publish" className="font-normal">Ready To Publish</SelectItem>
                                                    <SelectItem value="Published" className="font-bold text-primary">Published</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    {editableLead.purpose === 'Education' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-xl bg-primary/5 animate-fade-in-zoom border-primary/10">
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Degree</Label><Select value={editableLead.degree} onValueChange={(val) => handleFieldChange('degree', val)}><SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger><SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">{educationDegrees.map(d=><SelectItem key={d} value={d} className="font-normal">{d}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Year</Label><Select value={editableLead.year} onValueChange={(val) => handleFieldChange('year', val)}><SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger><SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">{educationYears.map(y=><SelectItem key={y} value={y} className="font-normal">{y}</SelectItem>)}</SelectContent></Select></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Semester</Label><Select value={editableLead.semester} onValueChange={(val) => handleFieldChange('semester', val)}><SelectTrigger className="font-bold border-primary/10"><SelectValue/></SelectTrigger><SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">{educationSemesters.map(s=><SelectItem key={s} value={s} className="font-normal">{s}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                    )}

                                    {editableLead.purpose === 'Medical' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-xl bg-primary/5 border-primary/10 animate-fade-in-up">
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Disease</Label><Input value={editableLead.diseaseIdentified || ''} onChange={(e) => handleFieldChange('diseaseIdentified', e.target.value)} className="font-bold text-primary border-primary/10"/></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Stage</Label><Input value={editableLead.diseaseStage || ''} onChange={(e) => handleFieldChange('diseaseStage', e.target.value)} className="font-bold text-primary border-primary/10"/></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Seriousness</Label><Select value={editableLead.seriousness || ''} onValueChange={(val) => handleFieldChange('seriousness', val)}><SelectTrigger className="font-bold text-primary border-primary/10"><SelectValue/></SelectTrigger><SelectContent className="animate-fade-in-zoom border-primary/10 shadow-dropdown">{leadSeriousnessLevels.map(l=><SelectItem key={l} value={l} className="font-normal">{l}</SelectItem>)}</SelectContent></Select></div>
                                        </div>
                                    )}

                                    <div><Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Description</Label><Textarea id="description" value={editableLead.description || ''} onChange={(e: any) => handleFieldChange('description', e.target.value)} rows={4} className="text-primary font-normal transition-all duration-300 focus:shadow-md border-primary/10" /></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Money Needed (₹)</Label><Input type="number" value={editableLead.requiredAmount || 0} onChange={(e) => handleFieldChange('requiredAmount', e.target.value)} className="text-primary font-bold transition-all duration-300 focus:shadow-md border-primary/10" /></div>
                                        <div className="space-y-1"><Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Target Goal (₹)</Label><Input type="number" value={editableLead.targetAmount || 0} onChange={(e) => handleFieldChange('targetAmount', e.target.value)} className="text-primary font-bold transition-all duration-300 focus:shadow-md border-primary/10" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1"><Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Start Date</Label><Input id="startDate" type="date" value={editableLead.startDate || ''} onChange={(e) => handleFieldChange('startDate', e.target.value)} className="font-bold text-primary border-primary/10" /></div>
                                        <div className="space-y-1"><Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">End Date</Label><Input id="endDate" type="date" value={editableLead.endDate || ''} onChange={(e) => handleFieldChange('endDate', e.target.value)} className="font-bold text-primary border-primary/10" /></div>
                                    </div>

                                    <div className="space-y-4 p-4 border rounded-xl bg-muted/5 border-primary/10 animate-fade-in-up">
                                        <h4 className="text-xs font-bold text-primary tracking-tight uppercase opacity-60">Shopping & Price Reference</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Shop Name</Label><Input value={editableLead.shopName || ''} onChange={(e) => handleFieldChange('shopName', e.target.value)} className="font-bold text-primary border-primary/10" /></div>
                                            <div className="space-y-1">
                                                <Label className="font-bold text-xs capitalize">Shop Contact</Label>
                                                <div className="flex gap-2">
                                                    <div className="w-24 shrink-0">
                                                        <Select value={shopPhonePrefix} onValueChange={(v) => {
                                                            setShopPhonePrefix(v);
                                                            const current = editableLead.shopContact || '';
                                                            const number = current.replace(/^\+\d+/, '');
                                                            handleFieldChange('shopContact', `${v}${number}`);
                                                        }}>
                                                            <SelectTrigger className="font-bold border-primary/10 h-10">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl shadow-dropdown border-primary/10">
                                                                <SelectItem value="+91">🇮🇳 +91</SelectItem>
                                                                <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                                                <SelectItem value="+44">🇬🇧 +44</SelectItem>
                                                                <SelectItem value="+971">🇦🇪 +971</SelectItem>
                                                                <SelectItem value="+966">🇸🇦 +966</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Input 
                                                        value={(editableLead.shopContact || '').replace(/^\+\d+/, '')} 
                                                        onChange={(e) => handleFieldChange('shopContact', `${shopPhonePrefix}${e.target.value.replace(/\D/g, '')}`)} 
                                                        className="font-bold text-primary border-primary/10 flex-1" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Shop Address</Label><Input value={editableLead.shopAddress || ''} onChange={(e) => handleFieldChange('shopAddress', e.target.value)} className="font-bold text-primary border-primary/10" /></div>
                                            <div className="space-y-1"><Label className="font-bold text-xs capitalize">Price Quoted Date</Label><Input type="date" value={editableLead.priceDate || ''} onChange={(e) => handleFieldChange('priceDate', e.target.value)} className="font-bold text-primary border-primary/10" /></div>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Internal Notes (Private)</Label>
                                        <Textarea value={editableLead.notes || ''} onChange={(e) => handleFieldChange('notes', e.target.value)} rows={3} className="text-primary font-normal transition-all duration-300 focus:shadow-md border-primary/10" />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs text-muted-foreground tracking-tight capitalize">Donation Types for this Goal</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border rounded-xl p-3 bg-white border-primary/10">
                                            {donationCategories.map(type => (
                                                <div key={type} className="flex items-center space-x-2 transition-all duration-300 hover:translate-x-1">
                                                    <Checkbox 
                                                        id={`edit-type-${type}`}
                                                        checked={editableLead.allowedDonationTypes?.includes(type)}
                                                        onCheckedChange={(checked) => {
                                                            const current = editableLead.allowedDonationTypes || [];
                                                            const updated = checked ? [...current, type] : current.filter(t => t !== type);
                                                            handleFieldChange('allowedDonationTypes', updated);
                                                        }}
                                                    />
                                                    <Label htmlFor={`edit-type-${type}`} className="text-xs font-bold cursor-pointer capitalize">{type}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="relative w-full h-40 rounded-lg overflow-hidden mb-4 bg-secondary flex items-center justify-center cursor-pointer transition-all duration-500 hover:shadow-lg group" onClick={() => { if (lead?.imageUrl || getDefaultImage(lead?.purpose)) handleViewImage(getImageSrc(lead?.imageUrl || getDefaultImage(lead?.purpose)), lead?.name || 'Lead Image'); }}>
                                        <Image src={getImageSrc(lead?.imageUrl || getDefaultImage(lead?.purpose))} alt={lead?.name || 'Lead Image'} fill sizes="(max-width: 768px) 100vw, 800px" className="object-cover transition-transform duration-700 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                    </div>
                                    <div className="space-y-2 font-normal text-foreground">
                                        <Label className="text-muted-foreground text-[10px] font-bold tracking-tight capitalize">Description</Label>
                                        <p className="mt-1 text-sm font-normal whitespace-pre-wrap leading-relaxed text-muted-foreground">{lead?.description || 'No description provided.'}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                        <div className="space-y-1 p-3 rounded-lg bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:shadow-sm"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Purpose</p><p className="font-bold tracking-tight text-primary text-sm">{lead?.purpose} {lead?.category && `(${lead.category})`}</p></div>
                                        <div className="space-y-1 p-3 rounded-lg bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:shadow-sm">
                                            <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">
                                                Target Goal
                                            </p>
                                            <p className="font-bold font-mono text-primary text-sm">₹{(fundingData?.targetAmount || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="space-y-1 p-3 rounded-lg bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:shadow-sm"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Start Date</p><p className="font-bold text-primary text-sm">{lead?.startDate || 'N/A'}</p></div>
                                        <div className="space-y-1 p-3 rounded-lg bg-primary/5 transition-all duration-300 hover:bg-primary/10 hover:shadow-sm"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">End Date</p><p className="font-bold text-primary text-sm">{lead?.endDate || 'N/A'}</p></div>
                                    </div>
                                    {(lead?.purpose === 'Education' || lead?.purpose === 'Medical') && (
                                        <div className="mt-4 p-4 rounded-xl border border-primary/10 bg-primary/5 grid grid-cols-1 sm:grid-cols-3 gap-4 font-bold transition-all duration-300 hover:shadow-md">
                                            {lead.purpose === 'Education' ? (
                                                <>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Degree / Class</p><p className="text-sm">{lead.degree || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Academic Year</p><p className="text-sm">{lead.year || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Semester</p><p className="text-sm">{lead.semester || 'N/A'}</p></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Disease Identified</p><p className="text-sm">{lead?.diseaseIdentified || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Disease Stage</p><p className="text-sm">{lead?.diseaseStage || 'N/A'}</p></div>
                                                    <div className="space-y-1"><p className="text-[10px] text-muted-foreground tracking-tight capitalize">Urgency Level</p><p className="text-sm">{lead?.seriousness || 'N/A'}</p></div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    
                                    {(lead?.shopName || lead?.priceDate) && (
                                        <div className="mt-4 p-4 rounded-xl border border-primary/10 bg-muted/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Shop Name</p><p className="text-sm font-bold text-primary">{lead.shopName || 'N/A'}</p></div>
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Shop Contact</p><p className="text-sm font-bold text-primary">{lead.shopContact || 'N/A'}</p></div>
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Shop Address</p><p className="text-sm font-bold text-primary">{lead.shopAddress || 'N/A'}</p></div>
                                            <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize">Price Quoted Date</p><p className="text-sm font-bold text-primary">{lead.priceDate || 'N/A'}</p></div>
                                        </div>
                                    )}

                                    {lead?.notes && (
                                        <div className="mt-4 p-4 rounded-xl border border-primary/10 bg-amber-50/30 animate-fade-in-up">
                                            <Label className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize opacity-60">Internal Notes (Private)</Label>
                                            <p className="mt-1 text-sm font-normal text-muted-foreground leading-relaxed italic">{lead.notes}</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                {fundingData && (
                    <div className="grid gap-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        {isVisible('funding_progress') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="flex items-center gap-2 font-bold text-primary capitalize"><Target className="h-6 w-6 text-primary" /> How much we've collected</CardTitle>
                                    <CardDescription className="font-normal text-primary/70">Verified donations for this case.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        <div className="relative h-48 sm:h-64 w-full transition-transform duration-500 hover:scale-105">
                                            {isClient ? (
                                                <ChartContainer config={{ progress: { label: 'Progress', color: 'hsl(var(--primary))' } }} className="mx-auto aspect-square h-full">
                                                    <RadialBarChart data={[{ name: 'Progress', value: fundingData.fundingProgress || 0, fill: 'hsl(var(--primary))' }]} startAngle={-270} endAngle={90} innerRadius="75%" outerRadius="100%" barSize={20}>
                                                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                                        <RadialBar dataKey="value" background={{ fill: 'hsl(var(--muted))' }} cornerRadius={10} className="transition-all duration-1000 ease-out" />
                                                    </RadialBarChart>
                                                </ChartContainer>
                                            ) : <Skeleton className="w-full h-full rounded-full" />}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center animate-fade-in-zoom"><span className="text-4xl font-bold text-primary">{(fundingData.fundingProgress || 0).toFixed(0)}%</span><span className="text-[10px] text-muted-foreground font-bold tracking-tight capitalize">Funded</span></div>
                                        </div>
                                        <div className="space-y-4 text-center md:text-left text-primary font-bold animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                                            <div 
                                                className="transition-transform hover:translate-x-1 cursor-pointer group duration-300"
                                                onClick={() => router.push(`/leads-members/${leadId}/donations?status=Verified`)}
                                            >
                                                <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize group-hover:text-primary transition-colors opacity-60">Money for this Target</p>
                                                <p className="text-3xl font-bold text-primary font-mono flex items-center justify-center md:justify-start gap-2">₹{(fundingData.totalCollectedForGoal || 0).toLocaleString('en-IN')} <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all"/></p>
                                            </div>
                                            <div className="transition-transform hover:translate-x-1 duration-300 relative group/target">
                                                <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize opacity-60">Target Goal</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-3xl font-bold text-primary opacity-40 font-mono">₹{(fundingData?.targetAmount || 0).toLocaleString('en-IN')}</p>
                                                    {canUpdateSummary && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6 opacity-0 group-hover/target:opacity-100 transition-opacity"
                                                            onClick={async () => {
                                                                setIsRecalculating(true);
                                                                const res = await recalculateLeadGoalAction(leadId);
                                                                if (res.success) {
                                                                    toast({ title: res.message, variant: "success" });
                                                                    forceRefetchLead();
                                                                } else {
                                                                    toast({ title: "Recalculation Failed", description: res.message, variant: "destructive" });
                                                                }
                                                                setIsRecalculating(false);
                                                            }}
                                                            disabled={isRecalculating}
                                                        >
                                                            <RefreshCw className={cn("h-3 w-3", isRecalculating && "animate-spin")} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div 
                                                className="transition-transform hover:translate-x-1 cursor-pointer group duration-300"
                                                onClick={() => router.push(`/leads-members/${leadId}/donations?status=Verified`)}
                                            >
                                                <p className="text-[10px] font-bold text-muted-foreground tracking-tight capitalize group-hover:text-primary transition-colors opacity-60">Total Money Collected</p>
                                                <p className="text-2xl font-bold text-primary font-mono flex items-center justify-center md:justify-start gap-2">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')} <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all"/></p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {isVisible('quick_stats') && (
                            <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 font-normal">
                                <Card 
                                    className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group"
                                    onClick={() => router.push(`/leads-members/${leadId}/beneficiaries`)}
                                >
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-[10px] font-bold text-primary tracking-tight capitalize">Beneficiaries</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-primary flex items-center justify-between">{fundingData.totalBeneficiaries} <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all"/></div>
                                    </CardContent>
                                </Card>
                                <Card 
                                    className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group"
                                    onClick={() => router.push(`/leads-members/${leadId}/beneficiaries?status=Given`)}
                                >
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-[10px] font-bold text-primary tracking-tight capitalize">{itemGivenLabel}</CardTitle>
                                        <Gift className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-primary flex items-center justify-between">{fundingData.beneficiariesGiven} <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all"/></div>
                                    </CardContent>
                                </Card>
                                <Card 
                                    className="bg-white border-primary/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer group"
                                    onClick={() => router.push(`/leads-members/${leadId}/beneficiaries?status=Pending`)}
                                >
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-[10px] font-bold text-primary tracking-tight capitalize">{itemPendingLabel}</CardTitle>
                                        <Hourglass className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-primary flex items-center justify-between">{fundingData.beneficiariesPending} <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all"/></div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {isVisible('beneficiary_groups') && (
                            <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-col">
                                <CardHeader className="bg-primary/5 border-b shrink-0">
                                    <CardTitle className="font-bold text-primary tracking-tight capitalize">
                                        How help is shared
                                    </CardTitle>
                                    <CardDescription className="font-normal text-primary/70">
                                        Details of help for this person.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 flex-1 overflow-hidden">
                                    <ScrollArea className="w-full h-full">
                                        <div className="p-4">
                                            <div className="border rounded-lg overflow-hidden font-normal text-foreground shadow-sm min-w-[650px] border-primary/10">
                                                {isRationInitiative ? (
                                                    <Table>
                                                        <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                                            <TableRow>
                                                                <TableHead className="font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Category Name</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Beneficiaries</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Unit Amount</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Total Amount</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {beneficiaryGroups.map((group) => (
                                                                <TableRow key={group.id} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors group bg-white border-b border-primary/5">
                                                                    <TableCell className="font-bold text-primary text-xs transition-transform group-hover:translate-x-1">{group.name}</TableCell>
                                                                    <TableCell className="text-right font-normal text-xs">{group.count}</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold text-xs">₹{group.kitAmount.toLocaleString('en-IN')}</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold text-xs">₹{group.totalAmount.toLocaleString('en-IN')}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        {beneficiaryGroups.length > 0 && (
                                                            <TableFooter className="bg-primary/5 border-t font-bold">
                                                                <TableRow>
                                                                    <TableCell colSpan={3} className="text-right font-bold text-primary text-[10px] tracking-tight capitalize">Total Help Needed</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold text-primary text-base">₹{calculatedRequirementTotal.toLocaleString('en-IN')}</TableCell>
                                                                </TableRow>
                                                            </TableFooter>
                                                        )}
                                                    </Table>
                                                ) : (
                                                    <Table>
                                                        <TableHeader className="bg-[hsl(var(--table-header-bg))]">
                                                            <TableRow>
                                                                <TableHead className="font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Item Description</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Quantity</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Unit Price</TableHead>
                                                                <TableHead className="text-right font-semibold text-[hsl(var(--table-header-fg))] text-[10px] tracking-tight capitalize">Total Cost</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {lead?.itemCategories?.[0]?.items.map((item, idx) => (
                                                                <TableRow key={idx} className="hover:bg-[hsl(var(--table-row-hover))] transition-colors group bg-white border-b border-primary/5 last:border-none">
                                                                    <TableCell className="font-medium text-xs transition-transform group-hover:translate-x-1">{item.name}</TableCell>
                                                                    <TableCell className="text-right text-xs">{item.quantity} {item.quantityType}</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price / (item.quantity || 1)).toLocaleString('en-IN')}</TableCell>
                                                                    <TableCell className="text-right font-mono font-bold text-xs">₹{(item.price || 0).toLocaleString('en-IN')}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        <TableFooter className="bg-primary/5 border-t font-bold">
                                                            <TableRow>
                                                                <TableCell colSpan={3} className="text-right font-bold text-primary text-[10px] tracking-tight capitalize">Help for one Person</TableCell>
                                                                <TableCell className="text-right font-mono font-bold text-primary text-lg">
                                                                    ₹{calculatedRequirementTotal.toLocaleString('en-IN')}
                                                                </TableCell>
                                                            </TableRow>
                                                        </TableFooter>
                                                    </Table>
                                                )}
                                            </div>
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-6 lg:grid-cols-2 font-normal">
                            {isVisible('fund_totals') && (
                                <Card className="shadow-sm border-primary/5 bg-white transition-all duration-300 hover:shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm tracking-tight capitalize">Money Collected by Type</CardTitle></CardHeader>
                                    <CardContent className="space-y-2 pt-6 font-normal text-foreground">
                                        {donationCategories.map(cat => (
                                            <div key={cat} className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 py-1 rounded">
                                                <span className="text-muted-foreground font-normal capitalize text-[10px] tracking-tight">{cat}</span>
                                                <span className="font-mono font-bold">₹{(fundingData.amountsByCategory[cat] || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        ))}
                                        <Separator className="bg-primary/10 my-2" />
                                        <div className="flex justify-between items-center text-lg font-bold text-primary px-2"><span>Total Funds Secured</span><span className="font-mono font-bold">₹{(fundingData.grandTotal || 0).toLocaleString('en-IN')}</span></div>
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('zakat_utilization') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm tracking-tight capitalize">Zakat Progress</CardTitle><CardDescription className="font-normal text-primary/70">How we used the Zakat money.</CardDescription></CardHeader>
                                    <CardContent className="space-y-3 pt-6 font-normal text-foreground">
                                        <div className="flex justify-between items-center text-sm font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded">
                                            <span className="text-muted-foreground tracking-tight font-normal capitalize text-[10px]">Total Zakat Received</span>
                                            <span className="font-bold font-mono">₹{fundingData.amountsByCategory.Zakat.toLocaleString('en-IN')}</span>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="pl-4 border-l-2 border-dashed border-primary/20 space-y-2 py-2 font-bold">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="text-muted-foreground tracking-tight font-normal capitalize text-[10px]">Allocated For Relief</span>
                                                <span className="font-bold font-mono">₹{fundingData.zakatAllocated.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="font-normal opacity-60 capitalize text-[9px]">Disbursed (Given)</span>
                                                <span className="font-mono text-primary font-bold">₹{fundingData.zakatGiven.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs font-bold text-primary transition-all hover:bg-primary/5 px-2 rounded">
                                                <span className="font-normal opacity-60 capitalize text-[9px]">Pending Verification</span>
                                                <span className="font-mono text-primary font-bold">₹{fundingData.zakatPending.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm font-bold text-primary px-2 transition-all hover:bg-primary/5 rounded">
                                                <span className="text-muted-foreground tracking-tight font-normal capitalize text-[10px]">Money Left to Use</span>
                                                <span className="font-bold text-primary font-mono">₹{fundingData.totalZakatBalance.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 font-normal text-primary">
                            {isVisible('donations_by_category') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm tracking-tight capitalize">Donations By Category</CardTitle></CardHeader>
                                    <CardContent className="pt-6 px-0 sm:px-6">
                                        {isClient ? (
                                        <ChartContainer config={donationCategoryChartConfig} className="h-[250px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartDataValues} layout="vertical" margin={{ right: 20 }}>
                                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} /><YAxis dataKey="name" type="category" tickLine={false} tickMargin={10} axisLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: 'hsl(var(--primary))' }} width={100}/><XAxis type="number" tickFormatter={(value) => `₹${Number(value).toLocaleString()}`} hide /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={4} className="transition-all duration-1000 ease-out">{chartDataValues.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}</Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full"/>}
                                    </CardContent>
                                </Card>
                            )}

                            {isVisible('donations_by_payment_type') && (
                                <Card className="shadow-sm border-primary/5 bg-white overflow-hidden transition-all duration-300 hover:shadow-xl">
                                    <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-bold text-primary text-sm tracking-tight capitalize">Payment Channels Used</CardTitle><CardDescription className="font-normal text-primary/70">Breakdown Of Funds By Contribution Channel.</CardDescription></CardHeader>
                                    <CardContent className="pt-6 px-0 sm:px-6">
                                        {isClient ? (
                                            <ChartContainer config={donationPaymentTypeChartConfig} className="h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <ChartTooltip 
                                                            content={
                                                                <ChartTooltipContent 
                                                                    nameKey="name" 
                                                                    formatter={(value, name, item) => (
                                                                        <div className="flex flex-col">
                                                                            <span className="font-bold">₹{Number(value).toLocaleString()}</span>
                                                                            <span className="text-[10px] opacity-70">{(item as any).payload.count} Donations</span>
                                                                        </div>
                                                                    )}
                                                                />
                                                            } 
                                                        />
                                                        <Pie data={paymentTypeChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={5} className="transition-all duration-1000 ease-out focus:outline-none">
                                                            {paymentTypeChartData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />))}
                                                        </Pie>
                                                        <ChartLegend content={<ChartLegendContent />} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <Skeleton className="h-[250px] w-full"/>}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}

                {isVisible('documents') && (
                    <Card className="animate-fade-in-up bg-white shadow-sm border-primary/10 transition-all duration-300 hover:shadow-xl" style={{ animationDelay: '400ms' }}>
                        <CardHeader className="bg-primary/5 border-b"><CardTitle className="font-bold text-primary text-sm tracking-tight capitalize">Proof Documents</CardTitle></CardHeader>
                        <CardContent className="font-normal text-primary pt-6">
                        {editMode ? (
                                <div className="space-y-4 animate-fade-in-zoom">
                                    <Label className="font-bold text-[10px] text-muted-foreground tracking-tight capitalize">Upload New Files</Label>
                                    <FileUploader onFilesChange={setNewDocuments} multiple acceptedFileTypes="image/png, image/jpeg, image/webp, application/pdf" />
                                    <Separator className="bg-primary/10 my-6" />
                                    <Label className="font-bold text-[10px] text-muted-foreground tracking-tight capitalize">Manage Saved Documents</Label>
                                    {existingDocuments.length > 0 ? (
                                        <div className="space-y-3 font-normal text-foreground">
                                            {existingDocuments.map((doc) => (
                                                <div key={doc.url} className="flex items-center justify-between p-2 border rounded-md gap-4 bg-primary/5 transition-all hover:bg-primary/10 border-primary/5">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <Button variant="link" className="p-0 h-auto font-bold truncate text-primary active:scale-95" onClick={() => { if (doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i)) handleViewImage(doc.url, doc.name); else window.open(doc.url, '_blank'); }}><p className="truncate text-xs">{doc.name}</p></Button>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2"><Switch checked={doc.isPublic} onCheckedChange={() => handleToggleDocumentPublic(doc.url)} /><Label className="text-[10px] text-foreground font-bold tracking-tight opacity-60 capitalize">Public</Label></div>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive transition-transform hover:scale-110 active:scale-90" onClick={() => handleRemoveExistingDocument(doc.url)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-[10px] text-muted-foreground font-bold tracking-tight italic capitalize opacity-60">No files found.</p>}
                                </div>
                            ) : (
                                lead?.documents && lead?.documents.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {lead.documents.map((doc, idx) => {
                                            const isImg = doc.name.match(/\.(jpeg|jpg|gif|png|webp)$/i);
                                            return (
                                                <Card key={doc.url} className="overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col active:scale-95 bg-white border-primary/10 cursor-pointer shadow-sm group animate-fade-in-up" style={{ animationDelay: `${50 + idx * 50}ms` }} onClick={() => { if (isImg) handleViewImage(doc.url, doc.name); else window.open(doc.url, '_blank'); }}>
                                                    <div className="block flex-grow">
                                                        <div className="relative aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
                                                            {isImg ? <Image src={`/api/image-proxy?url=${encodeURIComponent(doc.url)}`} alt={doc.name} fill sizes="100vw" className="object-cover transition-transform duration-500 group-hover:scale-110" /> : <File className="w-10 h-10 text-muted-foreground transition-transform duration-500 group-hover:scale-110" />}
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                                        </div>
                                                        <div className="p-2 text-center text-[10px] font-bold text-primary tracking-tight truncate transition-colors group-hover:text-primary/80 capitalize">{doc.name}</div>
                                                    </div>
                                                    <CardFooter className="p-2 border-t mt-auto flex justify-center w-full gap-2 bg-muted/5" onClick={e => e.stopPropagation()}>
                                                        {canUpdateSummary ? ( 
                                                            <div className="flex items-center gap-2">
                                                                <Switch checked={!!doc.isPublic} onCheckedChange={() => quickToggleDocumentPublic(doc)} />
                                                                <Label className="text-[9px] text-foreground font-bold tracking-tight capitalize">Public</Label>
                                                            </div>
                                                        ) : ( <Badge variant={doc.isPublic ? "eligible" : "secondary"} className="font-bold text-[9px] tracking-tight capitalize">{doc.isPublic ? "Public" : "Private"}</Badge> )}
                                                    </CardFooter>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : <p className="text-[10px] text-muted-foreground font-bold tracking-tight italic capitalize opacity-60">No verification artifacts found.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="mt-8 animate-fade-in-up">
                    <AuditHistory targetId={leadId} module="leads" />
                </div>
            </div>

            <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} shareData={shareDialogData} />

            <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-[24px] border-primary/10 shadow-2xl">
                    <DialogHeader className="px-6 py-4 border-b bg-primary/5"><DialogTitle className="font-bold text-primary tracking-tight text-sm capitalize">{imageToView?.name}</DialogTitle></DialogHeader>
                    <div className="p-4 bg-secondary/20 flex-1 overflow-hidden relative min-h-[70vh]">
                        {imageToView && (
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(imageToView.url)}`} alt="Viewer" fill sizes="100vw" className="object-contain transition-transform duration-200 ease-out origin-center" style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }} unoptimized />
                        )}
                    </div>
                    <DialogFooter className="sm:justify-center pt-4 flex-wrap gap-2 px-6 py-4 border-t bg-white">
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomIn className="mr-1 h-4 w-4"/> In</Button>
                        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><ZoomOut className="mr-1 h-4 w-4"/> Out</Button>
                        <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RotateCw className="mr-1 h-4 w-4"/> Rotate</Button>
                        <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }} className="font-bold border-primary/20 text-primary h-8 text-[10px] active:scale-95 transition-transform"><RefreshCw className="mr-1 h-4 w-4"/> Reset</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {userProfile && pendingSaveData && (
                <VerificationRequestDialog
                    isOpen={isVerificationDialogOpen}
                    onOpenChange={setIsVerificationDialogOpen}
                    user={{ id: userProfile.id, name: userProfile.name }}
                    isOptional={effectiveVerificationMode.toLowerCase() === 'optional' || userProfile.role === 'Admin'}
                    minApprovals={configSettings?.minApprovalsRequired || 1}
                    authorizedVerifiers={configSettings?.authorizedVerifiers}
                    onBypass={async () => {
                        setIsVerificationDialogOpen(false);
                        if (leadId && firestore) {
                            // Automatically clean up any existing pending requests when Admin bypasses
                            if (userProfile.role === 'Admin') {
                                await cleanupPendingVerificationsAction(leadId);
                            }

                            await updateDoc(doc(firestore, 'leads', leadId), {
                                ...pendingSaveData,
                                updatedById: userProfile.id,
                                updatedByName: userProfile.name,
                                updatedAt: serverTimestamp()
                            });
                            
                            // Log direct update
                            await recordAuditLogAction({
                                targetId: leadId,
                                targetCollection: 'leads',
                                module: 'leads',
                                action: 'UPDATE',
                                description: `Summary updated directly (Bypassed Verification)`,
                                performedBy: { id: userProfile.id, name: userProfile.name },
                                changes: serializeForAction(generateChanges(lead, pendingSaveData)),
                                originalValue: serializeForAction(lead),
                                newValue: serializeForAction(pendingSaveData)
                            });

                            toast({ title: 'Summary Updated', description: 'Changes applied directly.', variant: 'success' });
                            setEditMode(false);
                            forceRefetchLead();
                        }
                    }}
                    onSuccess={() => {
                        setEditMode(false);
                        forceRefetchLead();
                    }}
                    payload={{
                        targetId: leadId,
                        module: 'leads',
                        description: `Update summary for lead: ${lead?.name}`,
                        targetCollection: 'leads',
                        originalValue: lead || {},
                        newValue: pendingSaveData,
                        revalidatePath: `/leads-members/${leadId}/summary`
                    }}
                />
            )}
        </main>
    );
}

function HistorySection({ lead }: { lead: Lead | null }) {
    if (!lead) return null;
    return (
        <Card className="border-primary/10 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 border-b pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2 tracking-tight capitalize"><History className="h-4 w-4 opacity-40"/> Staff Record Log</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="mt-1 p-1.5 rounded bg-primary/5 text-primary"><Clock className="h-3.5 w-3.5"/></div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground capitalize tracking-tighter">Record Created By</p>
                        <p className="text-xs font-bold text-primary">{lead?.createdByName || 'Organization System'}</p>
                        <p className="text-[9px] font-mono opacity-60">Staff ID: {lead?.createdById || 'System'}</p>
                    </div>
                </div>
                {lead?.createdAt && (
                    <div className="flex items-start gap-3">
                        <div className="mt-1 p-1.5 rounded bg-primary/5 text-primary"><Calendar className="h-3.5 w-3.5"/></div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground capitalize tracking-tighter">Date Recorded</p>
                            <p className="text-xs font-bold text-primary">{(lead.createdAt as any).toDate?.().toLocaleString() || new Date(lead.createdAt as any).toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
