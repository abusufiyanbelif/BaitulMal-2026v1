
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate, getImageSrc } from '@/lib/utils';
import type { Donation, BrandingSettings, PaymentSettings } from '@/lib/types';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Lightbulb, FolderKanban, ShieldCheck } from 'lucide-react';
import Image from 'next/image';

interface DonationReceiptProps {
  donation: Donation;
  brandingSettings?: BrandingSettings;
  paymentSettings?: PaymentSettings;
}

const ReceiptRow = ({ label, value, isMono = false, isSmall = false, isBold = true }: { label: string; value: React.ReactNode; isMono?: boolean; isSmall?: boolean; isBold?: boolean }) => (
    <div className="flex justify-between items-center gap-3 py-1.5 border-b border-border/50 last:border-0 min-h-[30px]">
        <p className={cn("font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0", isSmall ? "text-[9px]" : "text-[10px]")}>{label}</p>
        <div className={cn(isBold ? "font-semibold" : "font-normal", "text-right text-foreground leading-normal break-words max-w-[280px]", isSmall ? "text-[11px]" : "text-xs", isMono ? 'font-mono' : '')}>{value}</div>
    </div>
);

export const DonationReceipt = React.forwardRef<HTMLDivElement, DonationReceiptProps>(
  ({ donation, brandingSettings, paymentSettings }, ref) => {
    
    const typeSplit = donation.typeSplit && donation.typeSplit.length > 0
      ? donation.typeSplit
      : (donation.type ? [{ category: donation.type, amount: donation.amount, forFundraising: true }] : []);

    const hasScreenshots = donation.transactions?.some(tx => tx.screenshotUrl);

    return (
        <div ref={ref} className="bg-background p-0 rounded-none w-[850px] max-w-full mx-auto">
            <Card className="w-full mx-auto shadow-none border border-border relative overflow-hidden bg-card flex flex-col justify-between text-card-foreground">
                {/* Organization Header (Dynamic Theme Colors using primary & primary-foreground) */}
                <div className="bg-primary text-primary-foreground px-8 py-5 flex items-center justify-between relative overflow-hidden shrink-0 border-b border-primary/20">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 opacity-50 pointer-events-none" />
                    <div className="flex items-center gap-4 relative z-10">
                        {brandingSettings?.logoUrl ? (
                            <div className="relative h-14 w-14 bg-white p-1.5 rounded-2xl shadow-xs border border-white/20 shrink-0">
                                <Image src={`/api/image-proxy?url=${encodeURIComponent(brandingSettings.logoUrl)}`} alt="Logo" fill className="object-contain p-1" unoptimized />
                            </div>
                        ) : (
                            <div className="h-12 w-12 bg-primary-foreground/15 rounded-xl flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                            </div>
                        )}
                        <div>
                            <h2 className="text-lg font-bold tracking-tight uppercase leading-tight text-primary-foreground">{brandingSettings?.name || 'Organization Registry'}</h2>
                            <p className="text-[10px] font-semibold text-primary-foreground/90 uppercase tracking-[0.2em] mt-0.5">Official Contribution Certificate</p>
                        </div>
                    </div>

                    <div className="text-right relative z-10 shrink-0">
                        <Badge variant="outline" className="border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground text-[10px] font-bold uppercase px-3 py-1 tracking-widest">
                            Audit Verified
                        </Badge>
                    </div>
                </div>

                {/* Main 2-Column Content Body */}
                <div className="relative p-6 flex-1 grid grid-cols-12 gap-6 items-start">
                    {/* Background Watermark */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.025] pointer-events-none rotate-[-25deg]">
                        <ShieldCheck className="w-96 h-96" />
                    </div>

                    {/* LEFT COLUMN: Registry, Financials, Categories, Initiatives, Transactions */}
                    <div className="col-span-7 space-y-4 relative z-10">
                        {/* Certificate Registry */}
                        <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-0.5">
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5 mb-1.5">Certificate Registry</h3>
                            <ReceiptRow label="Receipt No." value={donation.id.toUpperCase()} isMono />
                            {(donation.caseId || donation.linkSplit?.[0]?.caseId) && (
                                <ReceiptRow label="Case / Campaign ID" value={donation.caseId || donation.linkSplit?.[0]?.caseId} isMono />
                            )}
                            <ReceiptRow label="Issue Date" value={formatDate(donation.donationDate, { dateStyle: 'medium' })} />
                        </div>

                        {/* Financial Summary */}
                        <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-0.5">
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5 mb-1.5">Financial Summary</h3>
                            <ReceiptRow label="Receiver Entity" value={donation.receiverName} />
                            <ReceiptRow label="Total Impact" value={<span className="text-primary font-bold">₹{Number(donation.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>} isMono />
                            <ReceiptRow label="Instrument" value={<Badge variant="outline" className="text-[9px] font-semibold border-border px-2 py-0 text-foreground bg-background">{donation.donationType}</Badge>} />
                            {donation.transactions && donation.transactions[0]?.transactionId && (
                                <ReceiptRow label="Transaction Ref" value={donation.transactions[0].transactionId} isMono />
                            )}
                        </div>

                        {/* Category Distribution Table */}
                        <div className="space-y-1.5">
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider">Category Distribution</h3>
                            <div className="rounded-lg border border-border overflow-hidden bg-card shadow-2xs">
                                <Table>
                                    <TableHeader className="bg-primary/5">
                                        <TableRow className="hover:bg-transparent border-border">
                                            <TableHead className="text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Classification</TableHead>
                                            <TableHead className="text-right text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {typeSplit.map((split) => (
                                            <TableRow key={split.category} className="border-border/40 hover:bg-transparent">
                                                <TableCell className="py-1.5 text-[11px] font-medium text-foreground leading-normal">{split.category}</TableCell>
                                                <TableCell className="py-1.5 text-right font-mono text-[11px] font-bold text-foreground leading-normal">₹{Number(split.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Target Initiatives Table */}
                        {donation.linkSplit && donation.linkSplit.length > 0 && (
                            <div className="space-y-1.5">
                                <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider">Target Initiatives</h3>
                                <div className="rounded-lg border border-border overflow-hidden bg-card shadow-2xs">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow className="hover:bg-transparent border-border">
                                                <TableHead className="text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Target Area</TableHead>
                                                <TableHead className="text-right text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Allocation</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.linkSplit.map((link) => (
                                                <TableRow key={`${link.linkType}-${link.linkId}`} className="border-border/40 hover:bg-transparent">
                                                    <TableCell className="py-1.5 flex items-center gap-2">
                                                        {link.linkType === 'campaign' ? <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" /> : <Lightbulb className="h-3 w-3 text-muted-foreground shrink-0" />}
                                                        <div className="flex flex-col min-w-0 leading-normal">
                                                            <p className="font-semibold text-[11px] text-foreground break-words">{link.linkName}</p>
                                                            <p className="text-[9px] text-muted-foreground font-mono uppercase font-medium">ID: {link.caseId || link.linkId}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono text-[11px] font-bold text-foreground leading-normal">₹{Number(link.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Verified Transaction Logs */}
                        {donation.transactions && donation.transactions.length > 0 && (
                            <div className="space-y-1.5">
                                <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider">Verified Transaction Logs</h3>
                                <div className="rounded-lg border border-border overflow-hidden bg-card shadow-2xs">
                                    <Table>
                                        <TableHeader className="bg-primary/5">
                                            <TableRow className="hover:bg-transparent border-border">
                                                <TableHead className="text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Ref ID</TableHead>
                                                <TableHead className="text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Date</TableHead>
                                                <TableHead className="text-right text-[9px] font-bold text-foreground/80 uppercase tracking-wider h-7 py-1">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {donation.transactions.map((tx, idx) => (
                                                <TableRow key={tx.id || idx} className="border-border/40 hover:bg-transparent">
                                                    <TableCell className="py-1.5 font-mono text-[11px] font-semibold text-foreground leading-normal">{tx.transactionId || 'N/A'}</TableCell>
                                                    <TableCell className="py-1.5 text-[11px] font-medium text-muted-foreground leading-normal">{tx.date || donation.donationDate}</TableCell>
                                                    <TableCell className="py-1.5 text-right font-mono text-[11px] font-bold text-foreground leading-normal">₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Official Verification QR Code (Left Column, Below Verified Transaction Logs) */}
                        {paymentSettings?.qrCodeUrl && (
                            <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 flex flex-col items-center justify-center space-y-2">
                                <div className="flex items-center gap-2 border-b border-border/60 pb-1.5 w-full justify-center">
                                    <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider">Scan to Verify Record</h3>
                                </div>
                                <div className="relative h-36 w-36 border border-border p-2 rounded-xl bg-card shadow-xs shrink-0">
                                    <Image src={`/api/image-proxy?url=${encodeURIComponent(paymentSettings.qrCodeUrl)}`} alt="QR Code" fill className="object-contain p-1" unoptimized />
                                </div>
                                <p className="text-[9px] font-bold text-muted-foreground font-mono uppercase tracking-wider">Official Digital Verification</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Benefactor, Screenshot Artifact (Prominent & Clear), Contact Info */}
                    <div className="col-span-5 space-y-4 relative z-10">
                        {/* Benefactor Details */}
                        <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-0.5">
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5 mb-1.5">Benefactor Details</h3>
                            <ReceiptRow label="Legal Name" value={donation.donorName} />
                            {donation.donorPhone && <ReceiptRow label="Linked Contact" value={donation.donorPhone} isMono />}
                        </div>

                        {/* Transaction Screenshot Artifact(s) - High Visibility Container */}
                        {hasScreenshots && (
                            <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2">
                                <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wider flex items-center justify-between">
                                    <span>Payment Artifact Evidence</span>
                                    <span className="text-[9px] font-mono text-primary font-bold">Verified</span>
                                </p>
                                <div className="space-y-3">
                                    {donation.transactions!.filter(tx => tx.screenshotUrl).map((tx, idx) => (
                                        <div key={tx.id || idx} className="rounded-xl border border-border bg-card p-2.5 flex flex-col items-center justify-center shadow-xs min-h-[300px]">
                                            <img
                                                src={getImageSrc(tx.screenshotUrl!)}
                                                alt={`Payment Artifact ${idx + 1}`}
                                                className="max-h-[360px] h-auto w-auto max-w-full object-contain rounded-lg shadow-sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Acknowledgment Notes */}
                        {(donation.comments || donation.suggestions) && (
                            <div className="bg-muted/40 p-3 rounded-xl border border-border/60 space-y-1">
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acknowledgment Notes</h3>
                                {donation.comments && <p className="text-[11px] font-medium text-foreground italic leading-relaxed">"{donation.comments}"</p>}
                                {donation.suggestions && <p className="text-[11px] font-medium text-foreground italic leading-relaxed">"{donation.suggestions}"</p>}
                            </div>
                        )}

                        {/* Organization Contact */}
                        <div className="bg-muted/40 p-3.5 rounded-xl border border-border/60 space-y-2">
                            <h3 className="text-[10px] font-bold text-primary uppercase tracking-wider border-b border-border/60 pb-1.5">Organization Contact</h3>
                            <div className="space-y-0.5">
                                {paymentSettings?.upiId && <ReceiptRow label="UPI ID" value={paymentSettings.upiId} isMono isSmall />}
                                {paymentSettings?.contactPhone && <ReceiptRow label="Contact" value={paymentSettings.contactPhone} isMono isSmall />}
                                {paymentSettings?.contactEmail && <ReceiptRow label="Email" value={paymentSettings.contactEmail} isSmall />}
                                {paymentSettings?.website && <ReceiptRow label="Official Web" value={<span className="break-all">{paymentSettings.website}</span>} isSmall />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Banner */}
                <div className="bg-primary text-primary-foreground px-8 py-4 flex flex-col items-center justify-center text-center shrink-0 border-t border-primary/20">
                    <p className="font-bold text-lg tracking-tight text-primary-foreground">JazakAllah Khair!</p>
                    <p className="text-[10px] font-semibold text-primary-foreground/90 uppercase tracking-wider mt-0.5">May Allah accept your donation and bless you abundantly.</p>
                    <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-primary-foreground uppercase tracking-wider mt-2 py-1 px-3.5 bg-primary-foreground/15 rounded-lg border border-primary-foreground/20 shadow-2xs font-mono">
                        <span><strong className="text-primary-foreground/90 font-sans">Reg. No:</strong> {paymentSettings?.regNo || 'Solapur/0000373/2025'}</span>
                        <span className="text-primary-foreground/40">|</span>
                        <span><strong className="text-primary-foreground/90 font-sans">PAN:</strong> {paymentSettings?.pan || 'AAPAB1213J'}</span>
                    </div>
                    <div className="h-px w-20 bg-primary-foreground/20 my-2" />
                    <p className="text-[9px] font-medium text-primary-foreground/80">{paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.'}</p>
                </div>
            </Card>
        </div>
    );
  }
);
DonationReceipt.displayName = 'DonationReceipt';




