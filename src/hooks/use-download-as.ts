
'use client';

import { RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { BrandingSettings, PaymentSettings } from '@/lib/types';
import html2canvas from 'html2canvas';

interface DownloadOptions {
  contentRef: RefObject<HTMLDivElement>;
  documentTitle: string;
  documentName: string;
  brandingSettings: BrandingSettings | null;
  paymentSettings: PaymentSettings | null;
  skipLayout?: boolean;
}

const fetchAsDataURL = async (url: string | null | undefined): Promise<string | null> => {
    if (!url) return null;
    try {
        const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error: any) {
        console.error("Image fetch error:", error);
        return null;
    }
};

export function useDownloadAs() {
  const { toast } = useToast();

  const download = async (format: 'png' | 'pdf', options: DownloadOptions) => {
    const { contentRef, documentTitle, documentName, brandingSettings, paymentSettings } = options;
    const element = contentRef.current;
    if (!element) {
        toast({ title: 'Error', description: 'Cannot generate download, content is missing.', variant: 'destructive' });
        return;
    }

    toast({ title: `Generating ${format.toUpperCase()}...`, description: 'Please wait.' });

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff', // Use static color to prevent html2canvas parsing errors (Unsupported angle type)
        });

        const [logoDataUrl, qrDataUrl] = await Promise.all([
            fetchAsDataURL(brandingSettings?.logoUrl),
            fetchAsDataURL(paymentSettings?.qrCodeUrl)
        ]);

        const logoImg = logoDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = logoDataUrl; }) : null;
        const qrImg = qrDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = qrDataUrl; }) : null;

        if (format === 'png') {
            const PADDING = options.skipLayout ? 0 : 50;
            const HEADER_HEIGHT = options.skipLayout ? 0 : 100;
            const FOOTER_HEIGHT = options.skipLayout ? 0 : 250;
            const COPYRIGHT_HEIGHT = options.skipLayout ? 0 : 35;

            const finalCanvas = document.createElement('canvas');
            if (options.skipLayout) {
                finalCanvas.width = canvas.width;
                finalCanvas.height = canvas.height;
            } else {
                finalCanvas.width = 1200;
                finalCanvas.height = ((canvas.height * (finalCanvas.width - PADDING * 2)) / canvas.width) + HEADER_HEIGHT + FOOTER_HEIGHT + PADDING * 2 + COPYRIGHT_HEIGHT;
            }
            
            const ctx = finalCanvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            if (options.skipLayout) {
                ctx.drawImage(canvas, 0, 0);
            } else {
                const contentWidth = finalCanvas.width - PADDING * 2;
                const contentHeight = (canvas.height * contentWidth) / canvas.width;

                // Header
                let headerTextX = PADDING;
                if (logoImg) {
                    const logoHeight = 64;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    ctx.drawImage(logoImg, PADDING, PADDING / 2, logoWidth, logoHeight);
                    headerTextX = PADDING + logoWidth + 20;
                }
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 28px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(brandingSettings?.name || 'Registry', headerTextX, HEADER_HEIGHT / 2);

                // Title
                ctx.font = 'bold 24px sans-serif';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(documentTitle, PADDING, HEADER_HEIGHT + PADDING - 10);
                
                // Content
                ctx.drawImage(canvas, PADDING, HEADER_HEIGHT + PADDING, contentWidth, contentHeight);
                
                // Watermark
                if (logoImg) {
                    const wmScale = 0.45;
                    const wmWidth = finalCanvas.width * wmScale;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    ctx.globalAlpha = 0.04;
                    ctx.drawImage(logoImg, (finalCanvas.width - wmWidth) / 2, (finalCanvas.height - wmHeight) / 2, wmWidth, wmHeight);
                    ctx.globalAlpha = 1.0;
                }
                
                // Footer
                const footerY = finalCanvas.height - FOOTER_HEIGHT - COPYRIGHT_HEIGHT;
                if (qrImg) {
                    const qrSize = 140;
                    ctx.drawImage(qrImg, finalCanvas.width - PADDING - qrSize, footerY + 10, qrSize, qrSize);
                }
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText('For Donations & Contact', PADDING, footerY + 25);
                ctx.font = '14px sans-serif';
                ctx.fillStyle = '#334155';
                let textY = footerY + 55;
                const lineSpacing = 24;
                if (paymentSettings?.upiId) { ctx.fillText(`UPI: ${paymentSettings.upiId}`, PADDING, textY); textY += lineSpacing; }
                if (paymentSettings?.contactPhone) { ctx.fillText(`Phone: ${paymentSettings.contactPhone}`, PADDING, textY); textY += lineSpacing; }
                if (paymentSettings?.website) { ctx.fillText(`Website: ${paymentSettings.website}`, PADDING, textY); textY += lineSpacing; }
                const panVal = paymentSettings?.pan || 'AAPAB1213J';
                const regNoVal = paymentSettings?.regNo || 'Solapur/0000373/2025';
                if (panVal) { ctx.fillText(`PAN: ${panVal}`, PADDING, textY); textY += lineSpacing; }
                if (regNoVal) { ctx.fillText(`Reg. No: ${regNoVal}`, PADDING, textY); textY += lineSpacing; }
                if (paymentSettings?.address) { ctx.fillText(paymentSettings.address, PADDING, textY); textY += lineSpacing; }

                // Copyright
                ctx.textAlign = 'center';
                ctx.font = '13px sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText(paymentSettings?.copyright || '© 2026 Charity Registry. All Rights Reserved.', finalCanvas.width / 2, finalCanvas.height - 15);
            }

            const link = document.createElement('a');
            link.download = `${documentName}.png`;
            link.href = finalCanvas.toDataURL('image/png');
            link.click();

        } else { // pdf
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = options.skipLayout ? 0 : 12;
            let position = options.skipLayout ? 0 : margin;

            if (!options.skipLayout) {
                // Header
                pdf.setTextColor(19, 106, 51); // Dark green color
                if (logoImg && logoDataUrl) {
                    const logoHeight = 16;
                    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                    pdf.addImage(logoDataUrl, 'PNG', margin, position, logoWidth, logoHeight);
                    pdf.setFontSize(14);
                    const textY = position + (logoHeight / 2) + 2; // Vertically center text with logo
                    pdf.text(brandingSettings?.name || 'Registry', margin + logoWidth + 4, textY);
                    position += logoHeight + 8;
                } else {
                    pdf.setFontSize(14);
                    pdf.text(brandingSettings?.name || 'Registry', pdfWidth / 2, position, { align: 'center' });
                    position += 12;
                }

                // Title
                pdf.setFontSize(15).text(documentTitle, pdfWidth / 2, position, { align: 'center' });
                position += 10;

                // Watermark
                if (logoImg && logoDataUrl) {
                    pdf.saveGraphicsState();
                    pdf.setGState(new (pdf as any).GState({ opacity: 0.06 }));
                    const wmWidth = pdfWidth * 0.7;
                    const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                    pdf.addImage(logoDataUrl, 'PNG', (pdfWidth - wmWidth) / 2, (pdfHeight - wmHeight) / 2, wmWidth, wmHeight);
                    pdf.restoreGraphicsState();
                }
            }

            // Content
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const contentWidth = pdfWidth - margin * 2;
            const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
            
            if (options.skipLayout) {
                if (contentHeight > pdfHeight) {
                    const finalWidth = (imgProps.width * pdfHeight) / imgProps.height;
                    const xOffset = (pdfWidth - finalWidth) / 2;
                    pdf.addImage(imgData, 'PNG', xOffset, 0, finalWidth, pdfHeight);
                } else {
                    const yOffset = (pdfHeight - contentHeight) / 2;
                    pdf.addImage(imgData, 'PNG', 0, yOffset, pdfWidth, contentHeight);
                }
            } else {
                pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
            }

            if (!options.skipLayout) {
                // Footer
                const footerY = pdfHeight - 50;
                pdf.setLineWidth(0.2);
                pdf.line(margin, footerY, pdfWidth - margin, footerY);
                
                const qrSize = 32;
                const qrX = pdfWidth - margin - qrSize;
                if (qrImg && qrDataUrl) {
                    pdf.addImage(qrDataUrl, 'PNG', qrX, footerY + 3, qrSize, qrSize);
                }
                
                pdf.setFontSize(10);
                pdf.setTextColor(19, 106, 51);
                pdf.text('For Donations & Contact', margin, footerY + 8);
                pdf.setFontSize(8);
                pdf.setTextColor(50, 50, 50);

                const textBlockWidth = qrImg ? qrX - margin - 5 : pdfWidth - margin * 2;
                let textY = footerY + 13;
                
                const addFooterLine = (label: string, value: string | undefined) => {
                    if (!value) return;
                    const fullText = `${label}: ${value}`;
                    const lines = pdf.splitTextToSize(fullText, textBlockWidth);
                    pdf.text(lines, margin, textY);
                    textY += lines.length * 3.5;
                };

                addFooterLine('UPI', paymentSettings?.upiId);
                addFooterLine('Phone', paymentSettings?.contactPhone);
                addFooterLine('Email', paymentSettings?.contactEmail);
                addFooterLine('Website', paymentSettings?.website);
                addFooterLine('PAN', paymentSettings?.pan || 'AAPAB1213J');
                addFooterLine('Reg. No', paymentSettings?.regNo || 'Solapur/0000373/2025');
                
                if (paymentSettings?.address) {
                    const lines = pdf.splitTextToSize(paymentSettings.address, textBlockWidth);
                    pdf.text(lines, margin, textY);
                }

                // Copyright
                pdf.setFontSize(7.5);
                pdf.setTextColor(128, 128, 128);
                pdf.text(paymentSettings?.copyright || '© 2026 Charity Registry. All Rights Reserved.', pdfWidth / 2, pdfHeight - 6, { align: 'center' });
            }

            pdf.save(`${documentName}.pdf`);
        }
    } catch (error: any) {
        console.error("Download failed:", error);
        const errorMessage = error.message ? `: ${error.message}` : '. Please check console for details.';
        toast({ title: 'Download Failed', description: `Could not generate the file${errorMessage}. This can happen if images are blocked by browser security.`, variant: 'destructive', duration: 9000});
    }
  };

  return { download };
}
