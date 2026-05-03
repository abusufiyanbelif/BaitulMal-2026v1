'use client';

import React from 'react';
import { 
    GraduationCap, 
    HeartPulse, 
    LifeBuoy, 
    HandHelping, 
    HeartHandshake, 
    ShieldCheck, 
    Utensils,
    BookOpen,
    Pill,
    Hospital,
    Stethoscope,
    AlertCircle,
    Banknote,
    Waves,
    Heart,
    Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PurposePlaceholderProps {
    purpose?: string;
    category?: string;
    className?: string;
}

export function PurposePlaceholder({ purpose, category, className }: PurposePlaceholderProps) {
    const p = purpose?.toLowerCase() || '';
    const c = category?.toLowerCase() || '';

    let Icon = HeartHandshake;
    let colorClass = "from-slate-400 to-slate-600";
    let bgClass = "bg-slate-50";

    // 1. Category-specific Icons (Highest Specificity)
    if (c.includes('fees') || c.includes('college') || c.includes('school')) {
        Icon = GraduationCap;
    } else if (c.includes('tuition')) {
        Icon = BookOpen;
    } else if (c.includes('surgery') || c.includes('hospital')) {
        Icon = Hospital;
    } else if (c.includes('medication') || c.includes('pill') || c.includes('medicine')) {
        Icon = Pill;
    } else if (c.includes('ration') || c.includes('kit') || c.includes('food')) {
        Icon = Utensils;
    } else if (c.includes('financial') || c.includes('bill')) {
        Icon = Banknote;
    } else if (c.includes('disaster') || c.includes('flood') || c.includes('earthquake')) {
        Icon = Waves;
    } else if (c.includes('marriage') || c.includes('nikah')) {
        Icon = Heart;
    } else if (c.includes('employment') || c.includes('business') || c.includes('shop') || c.includes('auto')) {
        Icon = Briefcase;
    }
    // 2. Purpose-specific Fallbacks (Medium Specificity)
    else if (p === 'medical') {
        Icon = Stethoscope;
        colorClass = "from-rose-500 to-rose-700";
        bgClass = "bg-rose-50";
    } else if (p === 'education') {
        Icon = GraduationCap;
        colorClass = "from-sky-500 to-indigo-700";
        bgClass = "bg-sky-50";
    } else if (p === 'relief' || p === 'ration') {
        Icon = p === 'ration' ? Utensils : LifeBuoy;
        colorClass = "from-amber-500 to-orange-700";
        bgClass = "bg-amber-50";
    } else if (c.includes('marriage') || c.includes('nikah')) {
        Icon = Heart;
        colorClass = "from-pink-500 to-rose-600";
        bgClass = "bg-pink-50";
    } else if (c.includes('employment') || c.includes('business') || c.includes('shop')) {
        Icon = Briefcase;
        colorClass = "from-cyan-500 to-teal-700";
        bgClass = "bg-cyan-50";
    } else if (p === 'zakat' || p === 'general' || p === 'campaign' || c.includes('zakat')) {
        Icon = p === 'campaign' ? ShieldCheck : HeartHandshake;
        colorClass = "from-emerald-500 to-teal-700";
        bgClass = "bg-emerald-50";
    } else {
        Icon = AlertCircle;
        colorClass = "from-slate-500 to-slate-700";
        bgClass = "bg-slate-50";
    }

    // 3. Final Color Overrides based on Purpose (Consistency)
    if (p === 'medical') {
        colorClass = "from-rose-500 to-rose-700";
        bgClass = "bg-rose-50";
    } else if (p === 'education') {
        colorClass = "from-sky-500 to-indigo-700";
        bgClass = "bg-sky-50";
    } else if (p === 'relief' || p === 'ration') {
        colorClass = "from-amber-500 to-orange-700";
        bgClass = "bg-amber-50";
    } else if (c.includes('marriage') || c.includes('nikah')) {
        colorClass = "from-pink-500 to-rose-600";
        bgClass = "bg-pink-50";
    } else if (c.includes('employment') || c.includes('business') || c.includes('shop')) {
        colorClass = "from-cyan-500 to-teal-700";
        bgClass = "bg-cyan-50";
    } else if (p === 'zakat' || p === 'general' || p === 'campaign' || c.includes('zakat')) {
        colorClass = "from-emerald-500 to-teal-700";
        bgClass = "bg-emerald-50";
    }

    // 4. Simplify Labels for Common Users
    const getSimpleLabel = () => {
        const p = purpose?.toLowerCase() || '';
        const c = category?.toLowerCase() || '';
        
        if (c.includes('ration') || c.includes('food')) return "Food Help";
        if (c.includes('surgery')) return "Surgery Help";
        if (c.includes('medication') || c.includes('medicine')) return "Medicine Help";
        if (c.includes('fees')) return "School Fees";
        if (c.includes('marriage')) return "Marriage Help";
        if (c.includes('business') || c.includes('shop')) return "Business Help";
        if (c.includes('hospital')) return "Hospital Bill";
        
        if (p === 'medical') return "Hospital & Health";
        if (p === 'education') return "School & Study";
        if (p === 'relief') return "Emergency Help";
        if (p === 'zakat' || p === 'sadaqah' || p === 'general') return "Charity Aid";
        
        return purpose || category || "Charity Help";
    };

    return (
        <div className={cn(
            "w-full h-full flex flex-col items-center justify-center gap-3 relative overflow-hidden",
            bgClass,
            className
        )}>
            {/* Decorative Background Elements */}
            <div className={cn(
                "absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-gradient-to-br opacity-10",
                colorClass
            )} />
            <div className={cn(
                "absolute -left-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br opacity-5",
                colorClass
            )} />

            <div className={cn(
                "p-5 rounded-3xl bg-gradient-to-br shadow-xl shadow-black/5 animate-fade-in-zoom",
                colorClass
            )}>
                <Icon className="w-10 h-10 text-white" />
            </div>
            
            <div className="text-center animate-fade-in-up">
                <p className={cn(
                    "text-xs font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r",
                    colorClass
                )}>
                    {getSimpleLabel()}
                </p>
            </div>
        </div>
    );
}
