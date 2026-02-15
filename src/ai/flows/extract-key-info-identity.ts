'use server';
/**
 * @fileOverview This file defines a Genkit flow for extracting key information from an identity document image.
 *
 * @exports `extractKeyInfoFromAadhaar` - The main function to call for image-based extraction.
 * @exports `ExtractKeyInfoFromAadhaarInput` - The input type for the image flow.
 * @exports `ExtractKeyInfoFromAadhaarOutput` - The shared output type for both flows.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractKeyInfoFromAadhaarInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an identity card, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractKeyInfoFromAadhaarInput = z.infer<
  typeof ExtractKeyInfoFromAadhaarInputSchema
>;

const ExtractKeyInfoFromAadhaarOutputSchema = z.object({
  name: z.string().describe('The full name of the person as it appears on the card.'),
  dob: z.string().describe("The person's Date of Birth in DD/MM/YYYY format."),
  gender: z.string().describe("The person's gender (e.g., MALE, FEMALE)."),
  aadhaarNumber: z.string().describe("The 12-digit unique Aadhaar number, or other main ID number."),
  address: z.string().describe('The full residential address, including pin code.'),
});
export type ExtractKeyInfoFromAadhaarOutput = z.infer<
  typeof ExtractKeyInfoFromAadhaarOutputSchema
>;

export async function extractKeyInfoFromAadhaar(
  input: ExtractKeyInfoFromAadhaarInput
): Promise<ExtractKeyInfoFromAadhaarOutput> {
  return extractKeyInfoFromAadhaarFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractKeyInfoFromAadhaarPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: ExtractKeyInfoFromAadhaarInputSchema },
  output: { schema: ExtractKeyInfoFromAadhaarOutputSchema },
  prompt: `You are an expert in extracting information from Indian identity documents. Analyze the provided image of an identity card (like an Aadhaar card) and extract the name, date of birth, gender, ID number, and address.

Here is the image of the card:
---
Image: {{media url=photoDataUri}}
---
  `,
});

const extractKeyInfoFromAadhaarFlow = ai.defineFlow(
  {
    name: 'extractKeyInfoFromAadhaarFlow',
    inputSchema: ExtractKeyInfoFromAadhaarInputSchema,
    outputSchema: ExtractKeyInfoFromAadhaarOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
