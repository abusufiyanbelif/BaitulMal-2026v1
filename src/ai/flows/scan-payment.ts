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
import { withAIRetry } from '@/lib/ai-retry';

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
  senderName: z.string().optional().describe('The name of the person or entity who made the payment.'),
  amount: z.number().optional().describe('The transaction amount, as a number without currency symbols.'),
  transactionId: z.string().optional().describe('The Transaction ID, UPI Transaction ID, or any other unique reference number.'),
  date: z.string().optional().describe('The date of the transaction in YYYY-MM-DD format.'),
  upiId: z.string().optional().describe("The sender's UPI ID, if visible (e.g., something@okhdfcbank)."),
  receiverUpiId: z.string().optional().describe("The receiver's UPI ID, if visible (e.g., receiver@okhdfcbank)."),
  receiverBankDetails: z.string().optional().describe("The receiver's bank details (account #, bank name, IFSC) if visible."),
  onlineProvider: z.enum(['Google Pay', 'PhonePe', 'Paytm', 'Amazon Pay', 'WhatsApp Pay', 'Bank Transfer', 'Other']).optional().describe('The payment provider used (e.g., Google Pay, PhonePe, Paytm).'),
});
export type ScanPaymentScreenshotOutput = z.infer<typeof ScanPaymentScreenshotOutputSchema>;

export async function scanPaymentScreenshot(
  input: ScanPaymentScreenshotInput
): Promise<ScanPaymentScreenshotOutput> {
  return scanPaymentScreenshotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scanPaymentScreenshotPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ScanPaymentScreenshotInputSchema },
  output: { schema: ScanPaymentScreenshotOutputSchema },
  prompt: `You are an expert OCR agent specializing in parsing financial transaction screenshots from Indian payment apps like Google Pay and Paytm. Your task is to analyze the provided image and extract the following details precisely.

1.  **receiverName**: The name of the person or entity who received the payment. Look for labels like "Paid to", "To:", or the primary name displayed as the recipient.
2.  **senderName**: The name of the sender (the person making the payment). Look for labels like "From:", or your name/profile info on the payment receipt if visible.
3.  **amount**: Find the main transaction amount. It may have a currency symbol like '₹'. The value should be a number. For example, if you see '₹200', the value should be \`200\`.
4.  **transactionId**: Find the unique transaction identifier. Look for labels like "UPI Transaction ID", "Transaction ID", "UTR", or "Ref No.". Extract the alphanumeric code associated with it.
5.  **date**: Find the date of the transaction. If you find a date (e.g., "Jan 31, 2026", "31-01-2026"), you MUST format it as YYYY-MM-DD.
6.  **upiId**: Extract the sender's UPI ID. Look for labels like "From", "Debited from", or a UPI ID format (e.g., something@okhdfcbank) associated with the sender.
7.  **receiverUpiId**: Extract the receiver's UPI ID. Look for a UPI ID associated with the recipient (e.g., recipient@okicici).
8.  **receiverBankDetails**: Extract the receiver's bank details if visible (e.g., bank name, account number ending, IFSC).
9.  **onlineProvider**: Identify the app/service used based on logos and text ('Google Pay', 'PhonePe', 'Paytm', 'Amazon Pay', 'WhatsApp Pay', 'Bank Transfer', 'Other').

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
  async (input: ScanPaymentScreenshotInput) => {
    // Implemented retry logic to handle potential 429 errors
    const { output } = await withAIRetry(() => prompt(input));
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
