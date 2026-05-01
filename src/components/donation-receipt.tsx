
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import type { Donation, Campaign, Lead, BrandingSettings, PaymentSettings } from '@/lib/types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Lightbulb, FolderKanban, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

interface DonationReceiptProps {
  donation: Donation;
  brandingSettings?: BrandingSettings;
  paymentSettings?: PaymentSettings;
}

const ReceiptRow = ({ label, value, isMono = false, isSmall = false }: { label: string; value: React.ReactNode, isMono?: boolean, isSmall?: boolean }) => (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-slate-50/50 last:border-0">
        <p className={cn("font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap", isSmall ? "text-[8px]" : "text-[10px]")}>{label}</p>
        <p className={cn("font-bold text-right text-slate-900", isSmall ? "text-xs" : "text-sm", isMono ? 'font-mono' : '')}>{value}</p>
    </div>
);

export const DonationReceipt = React.forwardRef<HTMLDivElement, DonationReceiptProps>(
  ({ donation, brandingSettings, paymentSettings }, ref) => {
    
    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount, forFundraising: true }] : []);


    return (
        <div ref={ref} className="bg-white p-0 rounded-none w-full">
            <Card className="w-full max-w-2xl mx-auto shadow-none border-none relative overflow-hidden bg-white">
                {/* Institutional Header */}
                <div className="bg-slate-900 text-white p-12 flex flex-col items-center text-center space-y-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-40 pointer-events-none" />
                    {brandingSettings?.logoUrl ? (
                        <div className="relative h-24 w-24 bg-white p-3 rounded-3xl shadow-2xl relative z-10 ring-4 ring-white/10">
                            <Image src={`/api/image-proxy?url=${encodeURIComponent(brandingSettings.logoUrl)}`} alt="Logo" fill className="object-contain p-2" unoptimized />
                        </div>
                    ) : (
                        <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                        </div>
                    )}
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">{brandingSettings?.name || 'Institutional Registry'}</h2>
                        <div className="h-px w-12 bg-primary/40 mx-auto mt-4 mb-2" />
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Official Contribution Certificate</p>
                    </div>
                </div>

                <div className="relative p-8 space-y-8">
                    {/* Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-[-35deg]">
                        <ShieldCheck className="w-96 h-96" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Certificate Registry</h3>
                            <ReceiptRow label="Receipt No." value={donation.id.toUpperCase()} isMono />
                            <ReceiptRow label="Issue Date" value={formatDate(donation.donationDate, { dateStyle: 'medium' })} />
                            <ReceiptRow label="Audit Status" value={<Badge variant="eligible" className="text-[9px] font-black uppercase px-2 py-0">Verified</Badge>} />
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Benefactor Details</h3>
                            <ReceiptRow label="Legal Name" value={donation.donorName} />
                            {donation.donorPhone && <ReceiptRow label="Linked Contact" value={donation.donorPhone} isMono />}
                        </div>
                    </div>
                    <CardContent className="space-y-8 p-0">
                        <div className="space-y-4">
                             <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Financial Summary</h3>
                            <ReceiptRow label="Receiver Entity" value={donation.receiverName} />
                            <ReceiptRow label="Total Impact" value={`₹${Number(donation.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} isMono />
                            <ReceiptRow label="Instrument" value={<Badge variant="outline" className="text-[9px] font-bold border-slate-200">{donation.donationType}</Badge>} />
                            {donation.transactions && donation.transactions[0]?.transactionId && <ReceiptRow label="Transaction Reference" value={donation.transactions[0].transactionId} isMono />}
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Category Distribution</h3>
                            <div className="rounded-xl border border-slate-100 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Classification</TableHead>
                                            <TableHead className="text-right text-[9px] font-black uppercase tracking-widest h-10">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {typeSplit.map((split) => (
                                            <TableRow key={split.category} className="border-slate-50 hover:bg-transparent">
                                                <TableCell className="py-2 text-xs font-bold text-slate-600">{split.category}</TableCell>
                                                <TableCell className="py-2 text-right font-mono text-xs font-bold text-slate-900">₹{Number(split.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {donation.linkSplit && donation.linkSplit.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Target Initiatives</h3>
                                <div className="rounded-xl border border-slate-100 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow className="hover:bg-transparent border-slate-100">
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest h-10">Target Area</TableHead>
                                                <TableHead className="text-right text-[9px] font-black uppercase tracking-widest h-10">Allocation</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.linkSplit.map((link) => (
                                                <TableRow key={`${link.linkType}-${link.linkId}`} className="border-slate-50 hover:bg-transparent">
                                                    <TableCell className="py-2 flex items-center gap-2">
                                                        {link.linkType === 'campaign' ? <FolderKanban className="h-3 w-3 text-slate-400" /> : <Lightbulb className="h-3 w-3 text-slate-400" />}
                                                        <div className="flex flex-col">
                                                            <p className="font-bold text-xs text-slate-700">{link.linkName}</p>
                                                            <p className="text-[8px] text-slate-400 font-mono uppercase">{link.linkType}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right font-mono text-xs font-bold text-slate-900">₹{Number(link.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {(donation.comments || donation.suggestions) && (
                            <div className="space-y-4 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                                <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acknowledgment Notes</h3>
                                {donation.comments && <p className="text-xs font-bold text-slate-700 italic leading-relaxed">"{donation.comments}"</p>}
                                {donation.suggestions && <p className="text-xs font-bold text-slate-700 italic leading-relaxed">"{donation.suggestions}"</p>}
                            </div>
                        )}

                        <div className="pt-8 space-y-6 border-t border-slate-50">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-start">
                                 <div className="space-y-4">
                                     <h3 className="text-[9px] font-black text-primary uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Institutional Contact</h3>
                                     <div className="space-y-1">
                                         {paymentSettings?.upiId && <ReceiptRow label="UPI ID" value={paymentSettings.upiId} isMono isSmall />}
                                         {paymentSettings?.contactPhone && <ReceiptRow label="Contact" value={paymentSettings.contactPhone} isMono isSmall />}
                                         {paymentSettings?.contactEmail && <ReceiptRow label="Email" value={paymentSettings.contactEmail} isSmall />}
                                         {paymentSettings?.website && <ReceiptRow label="Official Web" value={paymentSettings.website} isSmall />}
                                         {paymentSettings?.pan && <ReceiptRow label="PAN" value={paymentSettings.pan} isMono isSmall />}
                                         {paymentSettings?.regNo && <ReceiptRow label="Registration" value={paymentSettings.regNo} isSmall />}
                                     </div>
                                 </div>
                                 {paymentSettings?.qrCodeUrl && (
                                     <div className="flex flex-col items-center sm:items-end space-y-2">
                                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verification QR</p>
                                         <div className="relative h-24 w-24 border border-slate-100 p-1 rounded-xl bg-white shadow-sm">
                                             <Image src={`/api/image-proxy?url=${encodeURIComponent(paymentSettings.qrCodeUrl)}`} alt="QR Code" fill className="object-contain" unoptimized />
                                         </div>
                                         <p className="text-[8px] font-bold text-slate-300 font-mono">{paymentSettings.upiId}</p>
                                     </div>
                                 )}
                             </div>
                             
                             <div className="text-center pt-4">
                                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Institutional Audit Trail Verified</p>
                                 {paymentSettings?.address && <p className="text-[8px] font-medium text-slate-400 mt-2 max-w-xs mx-auto">{paymentSettings.address}</p>}
                             </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col items-center justify-center text-center p-8 bg-slate-900 text-white rounded-b-[32px] mt-8">
                        <p className="font-black text-xl tracking-tight">JazakAllah Khair!</p>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2">May Allah accept your donation and bless you abundantly.</p>
                        <p className="text-[8px] font-medium text-white/20 mt-4">{paymentSettings?.copyright || '© 2026 Institutional Registry. All Rights Reserved.'}</p>
                    </CardFooter>
                </div>
            </Card>
        </div>
    );
  }
);
DonationReceipt.displayName = 'DonationReceipt';
