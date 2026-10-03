'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { usePaymentGateways } from '@/hooks/use-payment-gateways';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SectionLoader } from '@/components/section-loader';
import { 
  CreditCard, 
  ShieldCheck, 
  Save, 
  Loader2, 
  FlaskConical, 
  Globe2, 
  Users, 
  Smartphone, 
  Landmark, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import type { PaymentGatewaySettings } from '@/lib/types';

export default function PaymentGatewaysSettingsPage() {
  const { userProfile, isLoading: isSessionLoading } = useSession();
  const { gatewaySettings, isLoading: isGatewayLoading } = usePaymentGateways();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PaymentGatewaySettings | null>(null);

  const canEdit = userProfile?.role === 'Admin';

  useEffect(() => {
    if (gatewaySettings) {
      setFormData({
        isOnlineGatewayEnabled: gatewaySettings.isOnlineGatewayEnabled ?? true,
        isInternalTestMode: gatewaySettings.isInternalTestMode ?? false,
        isPublicGatewayEnabled: gatewaySettings.isPublicGatewayEnabled ?? true,
        isDonorGatewayEnabled: gatewaySettings.isDonorGatewayEnabled ?? true,
        activeGateway: gatewaySettings.activeGateway || 'razorpay',
        isMonthlyDonationEnabled: gatewaySettings.isMonthlyDonationEnabled ?? true,
        showUpiApps: gatewaySettings.showUpiApps ?? true,
        showNetBanking: gatewaySettings.showNetBanking ?? true,
        showCards: gatewaySettings.showCards ?? true,
        razorpay: {
          keyId: gatewaySettings.razorpay?.keyId || '',
          keySecret: gatewaySettings.razorpay?.keySecret || '',
          webhookSecret: gatewaySettings.razorpay?.webhookSecret || '',
          mode: gatewaySettings.razorpay?.mode || 'test',
          isEnabled: gatewaySettings.razorpay?.isEnabled ?? true,
        },
        instamojo: {
          apiKey: gatewaySettings.instamojo?.apiKey || '',
          authToken: gatewaySettings.instamojo?.authToken || '',
          salt: gatewaySettings.instamojo?.salt || '',
          mode: gatewaySettings.instamojo?.mode || 'test',
          isEnabled: gatewaySettings.instamojo?.isEnabled ?? false,
        },
        phonepe: {
          merchantId: gatewaySettings.phonepe?.merchantId || '',
          saltKey: gatewaySettings.phonepe?.saltKey || '',
          saltIndex: gatewaySettings.phonepe?.saltIndex || '1',
          mode: gatewaySettings.phonepe?.mode || 'test',
          isEnabled: gatewaySettings.phonepe?.isEnabled ?? false,
        }
      });
    } else if (!isGatewayLoading) {
      setFormData({
        isOnlineGatewayEnabled: true,
        isInternalTestMode: false,
        isPublicGatewayEnabled: true,
        isDonorGatewayEnabled: true,
        activeGateway: 'razorpay',
        isMonthlyDonationEnabled: true,
        showUpiApps: true,
        showNetBanking: true,
        showCards: true,
        razorpay: { keyId: '', keySecret: '', webhookSecret: '', mode: 'test', isEnabled: true },
        instamojo: { apiKey: '', authToken: '', salt: '', mode: 'test', isEnabled: false },
        phonepe: { merchantId: '', saltKey: '', saltIndex: '1', mode: 'test', isEnabled: false },
      });
    }
  }, [gatewaySettings, isGatewayLoading]);

  const handleSave = async () => {
    if (!firestore || !canEdit || !formData) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'settings', 'payment_gateways'), formData, { merge: true });
      toast({ title: 'Gateways Synchronized', description: 'Payment gateway configuration updated successfully.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Save Failed', description: e.message || 'Could not save payment gateway settings.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading || isGatewayLoading || !formData) {
    return <SectionLoader label="Retrieving Payment Gateway Parameters..." description="Connecting to Cloud Engine." />;
  }

  return (
    <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-primary font-normal min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-primary/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/settings/app" className="p-2 rounded-xl bg-primary/5 hover:bg-primary/10 text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Payment Gateways</h1>
          </div>
          <p className="text-sm text-muted-foreground opacity-80 pl-14">Configure online payment gateways (Razorpay, Instamojo, PhonePe) & control public/donor visibility.</p>
        </div>

        <Button onClick={handleSave} disabled={isSubmitting || !canEdit} className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-8 shadow-xl shadow-primary/20 active:scale-95 transition-all">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Gateway Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Global Access & Mode Controls */}
        <Card className="lg:col-span-3 rounded-[32px] border border-primary/10 bg-white shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary opacity-60" />
              <h3 className="font-black text-lg tracking-tight">Master Controls & Visibility Rules</h3>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold opacity-60">Primary Active Gateway:</Label>
              <Select value={formData.activeGateway} onValueChange={(val: any) => setFormData({ ...formData, activeGateway: val })}>
                <SelectTrigger className="w-44 h-10 font-bold rounded-xl border-primary/10 bg-primary/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="razorpay" className="font-bold text-xs">Razorpay Gateway</SelectItem>
                  <SelectItem value="instamojo" className="font-bold text-xs">Instamojo Gateway</SelectItem>
                  <SelectItem value="phonepe" className="font-bold text-xs">PhonePe PG</SelectItem>
                  <SelectItem value="none" className="font-bold text-xs">None (Disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/[0.02] border border-primary/5">
              <div className="space-y-0.5">
                <Label className="text-xs font-black">Master Gateway Switch</Label>
                <p className="text-[10px] text-muted-foreground">Master toggle for online checkout.</p>
              </div>
              <Switch checked={formData.isOnlineGatewayEnabled} onCheckedChange={(val) => setFormData({ ...formData, isOnlineGatewayEnabled: val })} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                  <Label className="text-xs font-black text-amber-900">Internal Team Test Mode</Label>
                </div>
                <p className="text-[10px] text-amber-700">Only staff can see & test gateway.</p>
              </div>
              <Switch checked={formData.isInternalTestMode} onCheckedChange={(val) => setFormData({ ...formData, isInternalTestMode: val })} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/[0.02] border border-primary/5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Globe2 className="h-3.5 w-3.5 text-primary opacity-60" />
                  <Label className="text-xs font-black">Public Direct Donate</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">Allow non-logged-in public checkout.</p>
              </div>
              <Switch checked={formData.isPublicGatewayEnabled} onCheckedChange={(val) => setFormData({ ...formData, isPublicGatewayEnabled: val })} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/[0.02] border border-primary/5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary opacity-60" />
                  <Label className="text-xs font-black">Donor Portal Checkout</Label>
                </div>
                <p className="text-[10px] text-muted-foreground">Allow gateway inside Donor Portal.</p>
              </div>
              <Switch checked={formData.isDonorGatewayEnabled} onCheckedChange={(val) => setFormData({ ...formData, isDonorGatewayEnabled: val })} />
            </div>
          </div>
        </Card>

        {/* Razorpay Gateway */}
        <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <div className="space-y-0.5">
              <h3 className="font-black text-lg text-blue-600">Razorpay Gateway</h3>
              <p className="text-[10px] text-muted-foreground">UPI, Cards, NetBanking, Wallets</p>
            </div>
            <Switch checked={formData.razorpay?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, razorpay: { ...formData.razorpay, isEnabled: val } })} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Key ID</Label>
              <Input value={formData.razorpay?.keyId || ''} onChange={(e) => setFormData({ ...formData, razorpay: { ...formData.razorpay, keyId: e.target.value } })} placeholder="rzp_test_xxxx" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Key Secret</Label>
              <Input type="password" value={formData.razorpay?.keySecret || ''} onChange={(e) => setFormData({ ...formData, razorpay: { ...formData.razorpay, keySecret: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Mode</Label>
              <Select value={formData.razorpay?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, razorpay: { ...formData.razorpay, mode: val } })}>
                <SelectTrigger className="rounded-xl h-11 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                  <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Instamojo Gateway */}
        <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <div className="space-y-0.5">
              <h3 className="font-black text-lg text-emerald-600">Instamojo Gateway</h3>
              <p className="text-[10px] text-muted-foreground">UPI Links, Cards & NEFT</p>
            </div>
            <Switch checked={formData.instamojo?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, instamojo: { ...formData.instamojo, isEnabled: val } })} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">API Key</Label>
              <Input value={formData.instamojo?.apiKey || ''} onChange={(e) => setFormData({ ...formData, instamojo: { ...formData.instamojo, apiKey: e.target.value } })} placeholder="instamojo_api_key" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Auth Token</Label>
              <Input type="password" value={formData.instamojo?.authToken || ''} onChange={(e) => setFormData({ ...formData, instamojo: { ...formData.instamojo, authToken: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Mode</Label>
              <Select value={formData.instamojo?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, instamojo: { ...formData.instamojo, mode: val } })}>
                <SelectTrigger className="rounded-xl h-11 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                  <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* PhonePe Gateway */}
        <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <div className="space-y-0.5">
              <h3 className="font-black text-lg text-purple-600">PhonePe PG</h3>
              <p className="text-[10px] text-muted-foreground">Direct PhonePe & UPI Intent</p>
            </div>
            <Switch checked={formData.phonepe?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, phonepe: { ...formData.phonepe, isEnabled: val } })} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Merchant ID</Label>
              <Input value={formData.phonepe?.merchantId || ''} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, merchantId: e.target.value } })} placeholder="PGTESTPAYUAT" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Salt Key</Label>
              <Input type="password" value={formData.phonepe?.saltKey || ''} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, saltKey: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Salt Index</Label>
              <Input value={formData.phonepe?.saltIndex || '1'} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, saltIndex: e.target.value } })} placeholder="1" className="font-mono text-xs rounded-xl h-11" />
            </div>
          </div>
        </Card>

      </div>
    </main>
  );
}
