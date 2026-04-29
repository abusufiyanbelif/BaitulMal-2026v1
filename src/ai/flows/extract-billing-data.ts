'use server';

/**
 * @fileOverview This file defines a Genkit flow for extracting billing data from an image.
 *
 * It includes:
 * - extractBillingDataFromImage: An async function to initiate the billing data extraction flow.
 * - ExtractBillingDataInput: The input type definition for the function, specifying the image.
 * - ExtractBillingDataOutput: The output type definition, detailing the extracted billing information.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractBillingDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a bill or invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractBillingDataInput = z.infer<typeof ExtractBillingDataInputSchema>;

const PurchasedItemSchema = z.object({
  item: z.string().describe('The name or description of the purchased item.'),
  quantity: z.number().optional().describe('The quantity of the item.'),
  unitPrice: z.number().optional().describe('The price per unit of the item.'),
  totalPrice: z.number().describe('The total price for the line item.'),
});

const ExtractBillingDataOutputSchema = z.object({
  vendorInformation: z.string().describe('The name and contact information of the vendor.'),
  dates: z.string().describe('The billing date and due date, if available.'),
  amounts: z.string().describe('The total amount due and any other relevant amounts.'),
  purchasedItems: z.array(PurchasedItemSchema).describe('An array of items or services purchased, with their details.'),
});
export type ExtractBillingDataOutput = z.infer<typeof ExtractBillingDataOutputSchema>;

export async function extractBillingDataFromImage(
  input: ExtractBillingDataInput
): Promise<ExtractBillingDataOutput> {
  return extractBillingDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractBillingDataPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ExtractBillingDataInputSchema },
  output: { schema: ExtractBillingDataOutputSchema },
  prompt: `You are an expert in extracting data from bills and invoices.

  Please extract the vendor information, dates, amounts, and purchased items from the image provided.

  Here is the image from the bill:
  ---
  Image: {{media url=photoDataUri}}
  ---`,
});

const extractBillingDataFlow = ai.defineFlow(
  {
    name: 'extractBillingDataFlow',
    inputSchema: ExtractBillingDataInputSchema,
    outputSchema: ExtractBillingDataOutputSchema,
  },
  async (input: ExtractBillingDataInput) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
