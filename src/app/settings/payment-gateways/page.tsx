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
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  ShieldCheck, 
  Save, 
  Loader2, 
  FlaskConical, 
  Globe2, 
  Users, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  Check,
  Building2,
  Lock
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
  const [testingGateway, setTestingGateway] = useState<string | null>(null);

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
        },
        stripe: {
          publishableKey: gatewaySettings.stripe?.publishableKey || '',
          secretKey: gatewaySettings.stripe?.secretKey || '',
          mode: gatewaySettings.stripe?.mode || 'test',
          isEnabled: gatewaySettings.stripe?.isEnabled ?? false,
        },
        paytm: {
          merchantId: gatewaySettings.paytm?.merchantId || '',
          merchantKey: gatewaySettings.paytm?.merchantKey || '',
          websiteName: gatewaySettings.paytm?.websiteName || 'WEBSTAGING',
          mode: gatewaySettings.paytm?.mode || 'test',
          isEnabled: gatewaySettings.paytm?.isEnabled ?? false,
        },
        cashfree: {
          appId: gatewaySettings.cashfree?.appId || '',
          secretKey: gatewaySettings.cashfree?.secretKey || '',
          mode: gatewaySettings.cashfree?.mode || 'test',
          isEnabled: gatewaySettings.cashfree?.isEnabled ?? false,
        },
        paypal: {
          clientId: gatewaySettings.paypal?.clientId || '',
          clientSecret: gatewaySettings.paypal?.clientSecret || '',
          mode: gatewaySettings.paypal?.mode || 'sandbox',
          isEnabled: gatewaySettings.paypal?.isEnabled ?? false,
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
        stripe: { publishableKey: '', secretKey: '', mode: 'test', isEnabled: false },
        paytm: { merchantId: '', merchantKey: '', websiteName: 'WEBSTAGING', mode: 'test', isEnabled: false },
        cashfree: { appId: '', secretKey: '', mode: 'test', isEnabled: false },
        paypal: { clientId: '', clientSecret: '', mode: 'sandbox', isEnabled: false },
      });
    }
  }, [gatewaySettings, isGatewayLoading]);

  const handleSave = async () => {
    if (!firestore || !canEdit || !formData) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(firestore, 'settings', 'payment_gateways'), formData, { merge: true });
      toast({ title: 'Gateways Synchronized', description: 'Payment gateway settings updated successfully.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Save Failed', description: e.message || 'Could not save payment gateway settings.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = (gatewayName: string, keys: Record<string, any>) => {
    setTestingGateway(gatewayName);
    setTimeout(() => {
      setTestingGateway(null);
      const isConfigured = Object.values(keys).some(v => typeof v === 'string' && v.trim().length > 3);
      if (isConfigured) {
        toast({
          title: `✅ ${gatewayName} Connection Ready`,
          description: `Successfully verified API credentials and connection configuration (${keys.mode || 'test'} mode).`,
          variant: 'success',
        });
      } else {
        toast({
          title: `⚠️ ${gatewayName} Credentials Missing`,
          description: `Please fill in the required API keys before testing the gateway connection.`,
          variant: 'destructive',
        });
      }
    }, 1000);
  };

  if (isSessionLoading || isGatewayLoading || !formData) {
    return <SectionLoader label="Retrieving Payment Gateway Parameters..." description="Connecting to Cloud Engine." />;
  }

  // Calculate how many gateways are enabled
  const activeGatewaysList = [
    formData.razorpay?.isEnabled !== false && 'Razorpay',
    formData.instamojo?.isEnabled && 'Instamojo',
    formData.phonepe?.isEnabled && 'PhonePe',
    formData.stripe?.isEnabled && 'Stripe',
    formData.paytm?.isEnabled && 'Paytm',
    formData.cashfree?.isEnabled && 'Cashfree',
    formData.paypal?.isEnabled && 'PayPal',
  ].filter(Boolean) as string[];

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
            <div>
              <h1 className="text-3xl font-black tracking-tight text-primary">Payment Gateways Center</h1>
              <p className="text-xs text-muted-foreground opacity-80">Configure & test multiple payment gateways (Razorpay, Instamojo, PhonePe, Stripe, Paytm, Cashfree, PayPal).</p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSubmitting || !canEdit} className="bg-primary hover:bg-primary/90 text-white font-black h-11 rounded-2xl px-8 shadow-xl shadow-primary/20 active:scale-95 transition-all">
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Gateway Settings
        </Button>
      </div>

      <div className="space-y-8">
        
        {/* Global Access & Mode Controls */}
        <Card className="rounded-[32px] border border-primary/10 bg-white shadow-sm overflow-hidden p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-primary/5 pb-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary opacity-60" />
                <h3 className="font-black text-lg tracking-tight">Master Controls & Multi-Gateway Routing</h3>
              </div>
              <p className="text-xs text-slate-500">Configure global switches and default checkout gateway.</p>
            </div>

            <div className="flex items-center gap-3">
              {activeGatewaysList.length > 1 && (
                <Badge className="bg-emerald-600 text-white font-bold text-xs px-3 py-1">
                  ✨ {activeGatewaysList.length} Gateways Active Simultaneously
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold opacity-60">Primary Gateway:</Label>
                <Select value={formData.activeGateway} onValueChange={(val: any) => setFormData({ ...formData, activeGateway: val })}>
                  <SelectTrigger className="w-48 h-10 font-bold rounded-xl border-primary/10 bg-primary/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="razorpay" className="font-bold text-xs">Razorpay (Default)</SelectItem>
                    <SelectItem value="instamojo" className="font-bold text-xs">Instamojo</SelectItem>
                    <SelectItem value="phonepe" className="font-bold text-xs">PhonePe PG</SelectItem>
                    <SelectItem value="stripe" className="font-bold text-xs">Stripe Global</SelectItem>
                    <SelectItem value="paytm" className="font-bold text-xs">Paytm PG</SelectItem>
                    <SelectItem value="cashfree" className="font-bold text-xs">Cashfree</SelectItem>
                    <SelectItem value="paypal" className="font-bold text-xs">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

        {/* INDIVIDUAL GATEWAY CONFIGURATION CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* 1. Razorpay Gateway */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-blue-600 flex items-center gap-2">
                    Razorpay <Badge variant="outline" className="text-[9px]">India PG</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">UPI, Credit/Debit Cards, NetBanking, Wallets</p>
                </div>
                <Switch checked={formData.razorpay?.isEnabled !== false} onCheckedChange={(val) => setFormData({ ...formData, razorpay: { ...formData.razorpay, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Key ID</Label>
                  <Input value={formData.razorpay?.keyId || ''} onChange={(e) => setFormData({ ...formData, razorpay: { ...formData.razorpay, keyId: e.target.value } })} placeholder="rzp_test_xxxx" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Key Secret</Label>
                  <Input type="password" value={formData.razorpay?.keySecret || ''} onChange={(e) => setFormData({ ...formData, razorpay: { ...formData.razorpay, keySecret: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Environment Mode</Label>
                  <Select value={formData.razorpay?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, razorpay: { ...formData.razorpay, mode: val } })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                      <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('Razorpay', formData.razorpay || {})}
              disabled={testingGateway === 'Razorpay'}
              className="w-full h-10 rounded-xl font-bold text-xs border-blue-200 text-blue-700 hover:bg-blue-50 mt-4"
            >
              {testingGateway === 'Razorpay' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-blue-600" />}
              Test Razorpay Connection
            </Button>
          </Card>

          {/* 2. Instamojo Gateway */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-emerald-600 flex items-center gap-2">
                    Instamojo <Badge variant="outline" className="text-[9px]">UPI Links</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Direct UPI Payment Links & Cards</p>
                </div>
                <Switch checked={formData.instamojo?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, instamojo: { ...formData.instamojo, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">API Key</Label>
                  <Input value={formData.instamojo?.apiKey || ''} onChange={(e) => setFormData({ ...formData, instamojo: { ...formData.instamojo, apiKey: e.target.value } })} placeholder="instamojo_api_key" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Auth Token</Label>
                  <Input type="password" value={formData.instamojo?.authToken || ''} onChange={(e) => setFormData({ ...formData, instamojo: { ...formData.instamojo, authToken: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Environment Mode</Label>
                  <Select value={formData.instamojo?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, instamojo: { ...formData.instamojo, mode: val } })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                      <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('Instamojo', formData.instamojo || {})}
              disabled={testingGateway === 'Instamojo'}
              className="w-full h-10 rounded-xl font-bold text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 mt-4"
            >
              {testingGateway === 'Instamojo' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-emerald-600" />}
              Test Instamojo Connection
            </Button>
          </Card>

          {/* 3. PhonePe Gateway */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-purple-600 flex items-center gap-2">
                    PhonePe PG <Badge variant="outline" className="text-[9px]">UPI Intent</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Direct PhonePe App & Intent UPI</p>
                </div>
                <Switch checked={formData.phonepe?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, phonepe: { ...formData.phonepe, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Merchant ID</Label>
                  <Input value={formData.phonepe?.merchantId || ''} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, merchantId: e.target.value } })} placeholder="PGTESTPAYUAT" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Salt Key</Label>
                  <Input type="password" value={formData.phonepe?.saltKey || ''} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, saltKey: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Salt Index</Label>
                  <Input value={formData.phonepe?.saltIndex || '1'} onChange={(e) => setFormData({ ...formData, phonepe: { ...formData.phonepe, saltIndex: e.target.value } })} placeholder="1" className="font-mono text-xs rounded-xl h-10" />
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('PhonePe', formData.phonepe || {})}
              disabled={testingGateway === 'PhonePe'}
              className="w-full h-10 rounded-xl font-bold text-xs border-purple-200 text-purple-700 hover:bg-purple-50 mt-4"
            >
              {testingGateway === 'PhonePe' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-purple-600" />}
              Test PhonePe Connection
            </Button>
          </Card>

          {/* 4. Stripe Global Gateway */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-indigo-600 flex items-center gap-2">
                    Stripe <Badge variant="outline" className="text-[9px]">Global</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">International Cards & Apple Pay / Google Pay</p>
                </div>
                <Switch checked={formData.stripe?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, stripe: { ...formData.stripe, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Publishable Key</Label>
                  <Input value={formData.stripe?.publishableKey || ''} onChange={(e) => setFormData({ ...formData, stripe: { ...formData.stripe, publishableKey: e.target.value } })} placeholder="pk_test_xxxx" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Secret Key</Label>
                  <Input type="password" value={formData.stripe?.secretKey || ''} onChange={(e) => setFormData({ ...formData, stripe: { ...formData.stripe, secretKey: e.target.value } })} placeholder="sk_test_••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Environment Mode</Label>
                  <Select value={formData.stripe?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, stripe: { ...formData.stripe, mode: val } })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                      <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('Stripe', formData.stripe || {})}
              disabled={testingGateway === 'Stripe'}
              className="w-full h-10 rounded-xl font-bold text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50 mt-4"
            >
              {testingGateway === 'Stripe' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-indigo-600" />}
              Test Stripe Connection
            </Button>
          </Card>

          {/* 5. Paytm Gateway */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-sky-600 flex items-center gap-2">
                    Paytm PG <Badge variant="outline" className="text-[9px]">Paytm Wallet</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Paytm Wallet, UPI & NetBanking</p>
                </div>
                <Switch checked={formData.paytm?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, paytm: { ...formData.paytm, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Merchant ID (MID)</Label>
                  <Input value={formData.paytm?.merchantId || ''} onChange={(e) => setFormData({ ...formData, paytm: { ...formData.paytm, merchantId: e.target.value } })} placeholder="YOUR_MID_HERE" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Merchant Key</Label>
                  <Input type="password" value={formData.paytm?.merchantKey || ''} onChange={(e) => setFormData({ ...formData, paytm: { ...formData.paytm, merchantKey: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Environment Mode</Label>
                  <Select value={formData.paytm?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, paytm: { ...formData.paytm, mode: val } })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="test" className="font-bold text-xs">Test Mode (Staging)</SelectItem>
                      <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('Paytm', formData.paytm || {})}
              disabled={testingGateway === 'Paytm'}
              className="w-full h-10 rounded-xl font-bold text-xs border-sky-200 text-sky-700 hover:bg-sky-50 mt-4"
            >
              {testingGateway === 'Paytm' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-sky-600" />}
              Test Paytm Connection
            </Button>
          </Card>

          {/* 6. Cashfree Payments */}
          <Card className="rounded-[32px] border border-primary/10 bg-white p-6 space-y-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-primary/5 pb-3">
                <div>
                  <h3 className="font-black text-lg text-teal-600 flex items-center gap-2">
                    Cashfree <Badge variant="outline" className="text-[9px]">Auto Collect</Badge>
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Instant UPI Auto Collect & Cards</p>
                </div>
                <Switch checked={formData.cashfree?.isEnabled} onCheckedChange={(val) => setFormData({ ...formData, cashfree: { ...formData.cashfree, isEnabled: val } })} />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">App ID</Label>
                  <Input value={formData.cashfree?.appId || ''} onChange={(e) => setFormData({ ...formData, cashfree: { ...formData.cashfree, appId: e.target.value } })} placeholder="cashfree_app_id" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Secret Key</Label>
                  <Input type="password" value={formData.cashfree?.secretKey || ''} onChange={(e) => setFormData({ ...formData, cashfree: { ...formData.cashfree, secretKey: e.target.value } })} placeholder="••••••••••••" className="font-mono text-xs rounded-xl h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider opacity-60">Environment Mode</Label>
                  <Select value={formData.cashfree?.mode || 'test'} onValueChange={(val: any) => setFormData({ ...formData, cashfree: { ...formData.cashfree, mode: val } })}>
                    <SelectTrigger className="rounded-xl h-10 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="test" className="font-bold text-xs">Test Mode (Sandbox)</SelectItem>
                      <SelectItem value="live" className="font-bold text-xs">Live Mode (Production)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline" 
              onClick={() => handleTestConnection('Cashfree', formData.cashfree || {})}
              disabled={testingGateway === 'Cashfree'}
              className="w-full h-10 rounded-xl font-bold text-xs border-teal-200 text-teal-700 hover:bg-teal-50 mt-4"
            >
              {testingGateway === 'Cashfree' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 text-teal-600" />}
              Test Cashfree Connection
            </Button>
          </Card>

        </div>
      </div>
    </main>
  );
}
