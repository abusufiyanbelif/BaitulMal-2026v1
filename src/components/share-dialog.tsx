

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, MessageSquare, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareData: {
    title: string;
    text: string;
    url: string;
  };
}

const XIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current">
        <title>X</title>
        <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
    </svg>
);

const WhatsAppIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current"><title>WhatsApp</title><path d="M12.001 2.002c-5.523 0-10 4.477-10 10 0 1.75.448 3.403 1.255 4.834L2.013 22l5.3-1.242a9.944 9.944 0 0 0 4.686 1.241c5.523 0 10-4.477 10-10s-4.477-10-10-10zm0 18.162c-1.55 0-3.023-.42-4.32-1.168L3.33 20.67l1.69-4.524a8.13 8.13 0 0 1-1.26-4.144c0-4.49 3.65-8.14 8.24-8.14s8.24 3.65 8.24 8.14-3.65 8.14-8.24 8.14zM8.53 7.73c-.27-.13-.59-.13-.85 0-.25.13-.59.43-.84.72-.25.29-.49.6-.63.84-.14.24-.28.53-.28.82 0 .29.14.58.42.87.28.29.62.63.95.96.33.33.68.68 1.05 1.05.74.74 1.48 1.34 2.37 1.78.89.44 1.7.67 2.37.67.59 0 1.1-.11 1.48-.33.38-.22.82-.74 1.1-1.5.28-.76.28-1.41 0-1.55-.14-.07-.28-.11-.42-.18-.14-.07-.3-.12-.46-.18-.4-.14-.82-.28-1.2-.42-.2-.07-.37-.11-.53 0-.16.11-.27.28-.35.42-.08.14-.15.27-.2.37-.05.1-.1.18-.18.23a.35.35 0 0 1-.25.08c-.1-.02-.2-.05-.28-.09-.5-.22-.97-.53-1.38-.93-.4-.4-.72-.88-.93-1.38-.04-.08-.06-.17-.04-.26a.35.35 0 0 1 .08-.25c.05-.08.1-.15.14-.2.12-.13.24-.26.38-.4.14-.14.2-.28.23-.42.03-.14.02-.28-.04-.42-.16-.4-.32-.82-.46-1.24-.07-.16-.11-.3-.18-.42z"/></svg>
);

const FacebookIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current"><title>Facebook</title><path d="M22.675 0h-21.35C.589 0 0 .589 0 1.325v21.351C0 23.411.589 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.735 0 1.325-.589 1.325-1.325V1.325C24 .589 23.411 0 22.675 0z"/></svg>
);

const LinkedInIcon = () => (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current"><title>LinkedIn</title><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>
);

export function ShareDialog({ open, onOpenChange, shareData }: ShareDialogProps) {
  const { toast } = useToast();
  const { title, text, url } = shareData;

  const [message, setMessage] = useState(text);

  useEffect(() => {
    if (open) {
      setMessage(text);
    }
  }, [open, text]);

  const copyToClipboard = (content: string, message: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast({
        title: message,
        variant: 'success',
        duration: 2000,
      });
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        title: 'Copy Failed',
        description: 'Could not copy content to clipboard.',
        variant: 'destructive',
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>
            Share this with your network to help spread the word.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
             <div className="space-y-2">
              <Label htmlFor="share-message" className="text-sm font-medium">
                Share Message
              </Label>
              <Textarea
                id="share-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="share-url" className="text-sm font-medium">
                    Shareable Link
                </Label>
                <div className="flex items-center gap-2">
                    <Input id="share-url" value={url} readOnly className="h-9" />
                    <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => copyToClipboard(url, 'Link copied to clipboard!')}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Separator />

            <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline" className="flex-1">
                    <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(message + '\n\n' + url)}`} target="_blank" rel="noopener noreferrer" >
                        <WhatsAppIcon /> <span className="ml-2">WhatsApp</span>
                    </a>
                </Button>
                 <Button asChild variant="outline" className="flex-1">
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <XIcon /> X (Twitter)
                    </a>
                </Button>
                 <Button asChild variant="outline" className="flex-1">
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                        <FacebookIcon /> <span className="ml-2">Facebook</span>
                    </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                    <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                        <LinkedInIcon /> <span className="ml-2">LinkedIn</span>
                    </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                        <Send className="mr-2" /> Telegram
                    </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                    <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message + '\n\n' + url)}`} target="_blank" rel="noopener noreferrer">
                        <Mail className="mr-2" /> Email
                    </a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                    <a href={`sms:?body=${encodeURIComponent(message + '\n\n' + url)}`}>
                        <MessageSquare className="mr-2" /> SMS
                    </a>
                </Button>
                 <Button variant="outline" onClick={() => copyToClipboard(message, 'Summary text copied!')} className="flex-1">
                    <Copy className="mr-2" /> Copy Text
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
