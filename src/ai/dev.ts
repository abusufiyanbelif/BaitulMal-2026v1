'use server';

import '@/ai/genkit';
import '@/ai/flows/extract-medical-findings';
import '@/ai/flows/extract-and-correct-text';
import '@/ai/flows/extract-billing-data';
import '@/ai/flows/extract-key-info-identity';
import '@/ai/flows/extract-dynamic-form';
import '@/ai/flows/create-lead-story';
import '@/ai/flows/extract-education-findings';
import '@/ai/flows/create-education-story';
import '@/ai/flows/scan-payment';
import '@/ai/flows/run-diagnostic-check';
