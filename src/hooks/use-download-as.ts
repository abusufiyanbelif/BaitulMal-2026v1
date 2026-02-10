'use client';

import { RefObject } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { BrandingSettings, PaymentSettings } from '@/lib/types';

interface DownloadOptions {
  contentRef: RefObject<HTMLDivElement>;
  documentTitle: string;
  documentName: string;
  brandingSettings: BrandingSettings | null;
  paymentSettings: PaymentSettings | null;
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
    } catch (error) {
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
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
        });

        const [logoDataUrl, qrDataUrl] = await Promise.all([
            fetchAsDataURL(brandingSettings?.logoUrl),
            fetchAsDataURL(paymentSettings?.qrCodeUrl)
        ]);

        const logoImg = logoDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = logoDataUrl; }) : null;
        const qrImg = qrDataUrl ? await new Promise<HTMLImageElement>(res => { const i = new Image(); i.onload = () => res(i); i.src = qrDataUrl; }) : null;

        if (format === 'png') {
            const PADDING = 50;
            const HEADER_HEIGHT = 100;
            const FOOTER_HEIGHT = 180;
            const COPYRIGHT_HEIGHT = 40;
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = canvas.width + PADDING * 2;
            finalCanvas.height = canvas.height + HEADER_HEIGHT + FOOTER_HEIGHT + PADDING + COPYRIGHT_HEIGHT;
            const ctx = finalCanvas.getContext('2d')!;
            
            ctx.fillStyle = 'hsl(140 40% 96%)';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

            // Header
            let headerTextX = PADDING;
            if (logoImg) {
                const logoHeight = 80;
                const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                ctx.drawImage(logoImg, PADDING, PADDING / 2, logoWidth, logoHeight);
                headerTextX = PADDING + logoWidth + 30;
            }
            ctx.fillStyle = 'hsl(142 70% 25%)'; // Use concrete color
            ctx.font = 'bold 32px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', headerTextX, (PADDING / 2) + 45);

            // Title
            ctx.font = 'bold 28px sans-serif';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(documentTitle, PADDING, HEADER_HEIGHT + PADDING/2);
            
            // Content
            ctx.drawImage(canvas, PADDING, HEADER_HEIGHT + PADDING);
            
            // Watermark
            if (logoImg) {
                const wmScale = 0.6;
                const wmWidth = finalCanvas.width * wmScale;
                const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                ctx.globalAlpha = 0.08;
                ctx.drawImage(logoImg, (finalCanvas.width - wmWidth) / 2, (finalCanvas.height - wmHeight) / 2, wmWidth, wmHeight);
                ctx.globalAlpha = 1.0;
            }
            
            // Footer
            const footerY = finalCanvas.height - FOOTER_HEIGHT - COPYRIGHT_HEIGHT;
            if (qrImg) {
                const qrSize = 150;
                ctx.drawImage(qrImg, finalCanvas.width - PADDING - qrSize, footerY + 15, qrSize, qrSize);
            }
            ctx.fillStyle = 'hsl(142 70% 25%)'; // Use concrete color
            ctx.font = 'bold 22px sans-serif';
            ctx.fillText('For Donations & Contact', PADDING, footerY + 30);
            ctx.font = '18px sans-serif';
            let textY = footerY + 65;
            if (paymentSettings?.upiId) { ctx.fillText(`UPI: ${paymentSettings.upiId}`, PADDING, textY); textY += 28; }
            if (paymentSettings?.contactPhone) { ctx.fillText(`Phone: ${paymentSettings.contactPhone}`, PADDING, textY); textY += 28; }
            if (paymentSettings?.website) { ctx.fillText(`Website: ${paymentSettings.website}`, PADDING, textY); textY += 28; }
            if (paymentSettings?.address) { ctx.fillText(paymentSettings.address, PADDING, textY); }

            // Copyright
            ctx.textAlign = 'center';
            ctx.font = '14px sans-serif';
            ctx.fillStyle = 'hsl(142 25% 40%)'; // Use concrete color
            ctx.fillText(paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.', finalCanvas.width / 2, finalCanvas.height - 20);

            const link = document.createElement('a');
            link.download = `${documentName}.png`;
            link.href = finalCanvas.toDataURL('image/png');
            link.click();
        } else { // pdf
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let position = margin;

            // Header
            pdf.setTextColor(19, 106, 51); // Dark green color
            if (logoImg && logoDataUrl) {
                const logoHeight = 20;
                const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
                pdf.addImage(logoDataUrl, 'PNG', margin, position, logoWidth, logoHeight);
                pdf.setFontSize(16);
                const textY = position + (logoHeight / 2) + 3; // Vertically center text with logo
                pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', margin + logoWidth + 5, textY);
                position += logoHeight + 10;
            } else {
                pdf.setFontSize(16);
                pdf.text(brandingSettings?.name || 'Baitulmal Samajik Sanstha Solapur', pdfWidth / 2, position, { align: 'center' });
                position += 15;
            }

            // Title
            pdf.setFontSize(18).text(documentTitle, pdfWidth / 2, position, { align: 'center' });
            position += 15;

            // Watermark
            if (logoImg && logoDataUrl) {
                pdf.saveGraphicsState();
                pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
                const wmWidth = pdfWidth * 0.75;
                const wmHeight = (logoImg.height / logoImg.width) * wmWidth;
                pdf.addImage(logoDataUrl, 'PNG', (pdfWidth - wmWidth) / 2, (pdfHeight - wmHeight) / 2, wmWidth, wmHeight);
                pdf.restoreGraphicsState();
            }

            // Content
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const contentWidth = pdfWidth - margin * 2;
            const contentHeight = (imgProps.height * contentWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);

            // Footer
            const footerY = pdfHeight - 65;
            pdf.setLineWidth(0.2);
            pdf.line(margin, footerY, pdfWidth - margin, footerY);
            
            const qrSize = 40;
            const qrX = pdfWidth - margin - qrSize;
            if (qrImg && qrDataUrl) {
                pdf.addImage(qrDataUrl, 'PNG', qrX, footerY + 5, qrSize, qrSize);
            }
            
            pdf.setFontSize(11);
            pdf.setTextColor(19, 106, 51);
            pdf.text('For Donations & Contact', margin, footerY + 12);
            pdf.setFontSize(9);
            pdf.setTextColor(0, 0, 0);

            const textBlockWidth = qrImg ? qrX - margin - 5 : pdfWidth - margin * 2;
            let textY = footerY + 18;
            
            const addFooterLine = (label: string, value: string | undefined) => {
                if (!value) return;
                const fullText = `${label}: ${value}`;
                const lines = pdf.splitTextToSize(fullText, textBlockWidth);
                pdf.text(lines, margin, textY);
                textY += lines.length * 4;
            };

            addFooterLine('UPI', paymentSettings?.upiId);
            addFooterLine('Phone', paymentSettings?.contactPhone);
            addFooterLine('Email', paymentSettings?.contactEmail);
            addFooterLine('Website', paymentSettings?.website);
            addFooterLine('PAN', paymentSettings?.pan);
            addFooterLine('Reg. No', paymentSettings?.regNo);
            
            if (paymentSettings?.address) {
                 const lines = pdf.splitTextToSize(paymentSettings.address, textBlockWidth);
                 pdf.text(lines, margin, textY);
            }

            // Copyright
            pdf.setFontSize(8);
            pdf.setTextColor(128, 128, 128);
            pdf.text(paymentSettings?.copyright || '© 2026 Baitulmal Samajik Sanstha Solapur. All Rights Reserved.', pdfWidth / 2, pdfHeight - 10, { align: 'center' });

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
