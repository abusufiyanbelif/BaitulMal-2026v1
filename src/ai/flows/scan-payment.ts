'use server';
/**
 * @fileOverview AI flow to extract key details from a payment confirmation image.
 *
 * - scanPaymentScreenshot - Function to extract amount, transaction ID, and date from an image.
 * - ScanPaymentScreenshotInput - Input type for scanPaymentScreenshot.
 * - ScanPaymentScreenshotOutput - Output type for scanPaymentScreenshot.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ScanPaymentScreenshotInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a payment confirmation, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ScanPaymentScreenshotInput = z.infer<typeof ScanPaymentScreenshotInputSchema>;

const ScanPaymentScreenshotOutputSchema = z.object({
  receiverName: z.string().optional().describe('The name of the person or entity who received the payment.'),
  amount: z.number().optional().describe('The transaction amount, as a number without currency symbols.'),
  transactionId: z.string().optional().describe('The Transaction ID, UPI Transaction ID, or any other unique reference number.'),
  date: z.string().optional().describe('The date of the transaction in YYYY-MM-DD format.'),
});
export type ScanPaymentScreenshotOutput = z.infer<typeof ScanPaymentScreenshotOutputSchema>;

export async function scanPaymentScreenshot(
  input: ScanPaymentScreenshotInput
): Promise<ScanPaymentScreenshotOutput> {
  return scanPaymentScreenshotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanPaymentScreenshotPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: ScanPaymentScreenshotInputSchema },
  output: { schema: ScanPaymentScreenshotOutputSchema },
  prompt: `You are an expert OCR agent specializing in parsing financial transaction screenshots from Indian payment apps like Google Pay and Paytm. Your task is to analyze the provided image and extract the following details precisely.

1.  **receiverName**: The name of the person or entity who received the payment. Look for labels like "Paid to", "To:", or the primary name displayed as the recipient.
2.  **amount**: Find the main transaction amount. It may have a currency symbol like '₹'. The value should be a number. For example, if you see '₹200', the value should be \`200\`.
3.  **transactionId**: Find the unique transaction identifier. Look for labels like "UPI Transaction ID", "Transaction ID", "UTR", or "Ref No.". Extract the alphanumeric code associated with it.
4.  **date**: Find the date of the transaction. If you find a date (e.g., "Jan 31, 2026", "31-01-2026"), you MUST format it as YYYY-MM-DD.

If any of these fields are not clearly visible, omit them from the output.

---
EXTRACT FROM THIS IMAGE:
{{media url=photoDataUri}}
---
`,
});

const scanPaymentScreenshotFlow = ai.defineFlow(
  {
    name: 'scanPaymentScreenshotFlow',
    inputSchema: ScanPaymentScreenshotInputSchema,
    outputSchema: ScanPaymentScreenshotOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
