'use server';
/**
 * @fileOverview AI flow to extract key details from an Indian Aadhaar Card image.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { withAIRetry } from '@/lib/ai-retry';

const ScanAadhaarInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an Aadhaar identity card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ScanAadhaarInput = z.infer<typeof ScanAadhaarInputSchema>;

const ScanAadhaarOutputSchema = z.object({
  aadhaarNumber: z.string().optional().describe('The 12-digit Aadhaar Card Number without spaces.'),
  aadhaarName: z.string().optional().describe('The full name of the Aadhaar holder as printed.'),
  aadhaarDob: z.string().optional().describe('The Date of Birth in YYYY-MM-DD format.'),
  aadhaarGender: z.string().optional().describe('Gender (Male, Female, Other).'),
  aadhaarAddress: z.string().optional().describe('The complete residential address as written on the back of the Aadhaar card.'),
});
export type ScanAadhaarOutput = z.infer<typeof ScanAadhaarOutputSchema>;

const prompt = ai.definePrompt({
  name: 'scanAadhaarPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ScanAadhaarInputSchema },
  output: { schema: ScanAadhaarOutputSchema },
  prompt: `You are an expert OCR agent specializing in parsing Indian Aadhaar identification documents. Your task is to analyze the provided image and extract the following details precisely.

1.  **aadhaarNumber**: The 12-digit unique Aadhaar number (e.g., 1234 5678 9012). Extract ONLY the numeric digits without spaces.
2.  **aadhaarName**: The full name of the cardholder as written on the card.
3.  **aadhaarDob**: The cardholder's date of birth. You MUST format it as YYYY-MM-DD.
4.  **aadhaarGender**: The gender printed on the card (Male / Female).
5.  **aadhaarAddress**: Look at the address portion (typically on the back of the Aadhaar card starting with "Care of" or "C/O"). Extract the full text address.

If any of these fields are not clearly visible or legible, omit them from the output.

---
EXTRACT FROM THIS IMAGE:
{{media url=photoDataUri}}
---
`,
});

export async function scanAadhaarCard(
  input: ScanAadhaarInput
): Promise<ScanAadhaarOutput> {
  const { output } = await withAIRetry(() => prompt(input));
  if (!output) {
    throw new Error("The AI model did not return a valid output.");
  }
  return output;
}
