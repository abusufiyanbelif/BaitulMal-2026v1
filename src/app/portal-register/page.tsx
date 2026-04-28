'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { registerSupporterAction } from './actions';
import { Loader2, ArrowLeft, Send, Heart, ShieldCheck, HelpCircle, Phone, Lock, Info, User, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const registerSchema = z.object({
  role: z.enum(['Donor', 'Beneficiary']),
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  phone: z.string().length(10, 'Phone must be exactly 10 digits.'),
  password: z.string().min(4, 'Password must be at least 4 characters.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  address: z.string().optional(),
  age: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Must be a valid number' }),
  occupation: z.string().optional(),
  telegramChatId: z.string().optional().refine(val => !val || !isNaN(Number(val)), { message: 'Chat ID must be a number' }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function PortalRegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'Donor' | 'Beneficiary'>('Donor');

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'Donor',
      name: '',
      phone: '',
      password: '',
      email: '',
      address: '',
      age: '',
      occupation: '',
      telegramChatId: '',
    }
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const res = await registerSupporterAction({
        ...data,
        role: activeTab,
        age: data.age ? Number(data.age) : undefined,
      });

      if (res.success) {
        toast({ title: 'Success', description: res.message, variant: 'success' });
        router.push('/portal-login');
      } else {
        toast({ title: 'Registration Failed', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto pt-10 pb-20 px-4 sm:px-0 min-h-screen flex flex-col justify-center animate-fade-in-up">
      <div className="mb-4">
        <Button variant="outline" asChild className="font-bold border-primary/20 text-primary transition-transform active:scale-95">
          <Link href="/portal-login"><ArrowLeft className="mr-2 h-4 w-4" /> Back To Login</Link>
        </Button>
      </div>

      <Card className="border-primary/10 shadow-2xl bg-white overflow-hidden rounded-[24px]">
        <CardHeader className="text-center bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b pb-6">
          <div className="mx-auto bg-white p-3 rounded-2xl w-fit shadow-md border border-primary/10 mb-2">
            <Heart className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <CardTitle className="font-extrabold text-primary text-3xl tracking-tight">Create an Account</CardTitle>
          <CardDescription className="font-normal px-2 mt-1">
            Join the BaitulMal network as a Contributor or a Recipient.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <Tabs defaultValue="Donor" onValueChange={(val) => {
            setActiveTab(val as any);
            form.setValue('role', val as any);
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-primary/5 p-1.5 rounded-[16px] h-12 mb-6">
              <TabsTrigger value="Donor" className="font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-[12px] transition-all h-full">
                I am a Donor
              </TabsTrigger>
              <TabsTrigger value="Beneficiary" className="font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-[12px] transition-all h-full">
                I am a Recipient
              </TabsTrigger>
            </TabsList>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <div className="bg-primary/[0.02] p-4 rounded-2xl border border-primary/5 space-y-4">
                  <h3 className="text-sm font-bold text-primary tracking-tight flex items-center gap-2">
                    <User className="h-4 w-4 opacity-70" /> Basic Information
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-primary/80 text-xs">Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Moosa Shaikh" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-primary/80 text-xs">Mobile Number (10 digits) *</FormLabel>
                          <FormControl>
                            <Input placeholder="9876543210" maxLength={10} {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-primary/80 text-xs">Account Password *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Donor Specific Fields */}
                {activeTab === 'Donor' && (
                  <div className="bg-primary/[0.02] p-4 rounded-2xl border border-primary/5 space-y-4 animate-fade-in-up">
                    <h3 className="text-sm font-bold text-primary tracking-tight flex items-center gap-2">
                      <Heart className="h-4 w-4 opacity-70" /> Donor Details (Optional)
                    </h3>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-primary/80 text-xs">Email Address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="donor@example.com" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-primary/80 text-xs">Location / Address</FormLabel>
                          <FormControl>
                            <Input placeholder="City, Country" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Beneficiary Specific Fields */}
                {activeTab === 'Beneficiary' && (
                  <div className="bg-primary/[0.02] p-4 rounded-2xl border border-primary/5 space-y-4 animate-fade-in-up">
                    <h3 className="text-sm font-bold text-primary tracking-tight flex items-center gap-2">
                      <Heart className="h-4 w-4 opacity-70" /> Recipient Details (Optional)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-primary/80 text-xs">Your Age</FormLabel>
                            <FormControl>
                              <Input placeholder="30" type="number" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="occupation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold text-primary/80 text-xs">Occupation</FormLabel>
                            <FormControl>
                              <Input placeholder="Driver, Teacher, etc." {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold text-primary/80 text-xs">Full Residential Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Full Address with Landmark" {...field} className="h-11 rounded-[12px] border-primary/20 focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Telegram & OTP Section with steps */}
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/50 space-y-4">
                  <h3 className="text-sm font-bold text-blue-900 tracking-tight flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-600" /> Telegram Verification (Recommended)
                  </h3>
                  
                  {/* Telegram Instructions */}
                  <div className="bg-white/80 p-4 rounded-xl border border-blue-100 shadow-sm space-y-3 text-xs">
                    <p className="font-bold text-blue-900 flex items-center gap-1">
                      <HelpCircle className="h-4 w-4 text-blue-600" /> How to find your Telegram Chat ID?
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-primary/80 font-normal leading-relaxed">
                      <li>Open <span className="font-bold text-blue-600">Telegram</span> on your mobile or PC.</li>
                      <li>Search for the bot <span className="font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-mono select-all">@userinfobot</span> or <span className="font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md font-mono select-all font-normal">@GetMyChatID_Bot</span>.</li>
                      <li>Click <span className="font-bold text-blue-800">START</span> or send any message.</li>
                      <li>The bot will instantly reply with your <span className="font-bold text-blue-800">Id</span> (a numeric string like <span className="font-mono">87452695</span>).</li>
                      <li><span className="font-bold">Copy</span> that number and paste it below.</li>
                    </ol>
                    <div className="bg-blue-100/50 p-2 rounded-lg text-[11px] text-blue-800 font-medium flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>This ensures you can securely receive OTP updates on Telegram when logging in.</span>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="telegramChatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold text-blue-900 text-xs">Telegram Chat ID (Numeric)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 87452695" {...field} className="h-11 rounded-[12px] border-blue-200 focus:border-blue-500 font-mono" />
                        </FormControl>
                        <FormDescription className="text-[10px] text-blue-800/70 font-normal">Leave blank if you do not want to connect Telegram.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full h-12 font-bold shadow-lg active:scale-95 transition-all mt-6 text-base" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Complete Registration'}
                </Button>
              </form>
            </Form>
          </Tabs>
        </CardContent>
      </Card>
      
      <p className="text-center w-full mt-6 text-sm opacity-60 font-bold block">
         Already registered? <Link href="/portal-login" className="underline text-primary hover:text-primary/80 transition-colors">Log in here.</Link>
      </p>
    </div>
  );
}
