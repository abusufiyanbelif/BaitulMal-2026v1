'use server';
/**
 * @fileOverview AI flow to extract medical findings from a report image.
 *
 * - extractMedicalFindings - Function to extract medical details from an image.
 * - ExtractMedicalFindingsInput - Input type for extractMedicalFindings.
 * - ExtractMedicalFindingsOutput - Output type for extractMedicalFindings.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractMedicalFindingsInputSchema = z.object({
  reportDataUri: z
    .string()
    .describe(
      "An image of a medical report as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export type ExtractMedicalFindingsInput = z.infer<typeof ExtractMedicalFindingsInputSchema>;

const FindingSchema = z.object({
    finding: z.string().describe('A specific observation or finding from the report.'),
    details: z.string().describe('Any relevant details, measurements, or notes about the finding.'),
});

const ExtractMedicalFindingsOutputSchema = z.object({
  diagnosis: z.string().describe('The main diagnosis or impression from the report.'),
  findings: z.array(FindingSchema).describe('A structured list of key findings from the medical report.'),
});

export type ExtractMedicalFindingsOutput = z.infer<typeof ExtractMedicalFindingsOutputSchema>;

export async function extractMedicalFindings(
  input: ExtractMedicalFindingsInput
): Promise<ExtractMedicalFindingsOutput> {
  return extractMedicalFindingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractMedicalFindingsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: ExtractMedicalFindingsInputSchema },
  output: { schema: ExtractMedicalFindingsOutputSchema },
  prompt: `You are an expert medical analyst tasked with extracting key information from an image of a medical report.

  Analyze the provided image and extract the diagnosis and key findings.

  Here is the image from the medical report:
  ---
  Image: {{media url=reportDataUri}}
  ---

  Ensure that the diagnosis and findings are accurate and comprehensive.
`,
});

const extractMedicalFindingsFlow = ai.defineFlow(
  {
    name: 'extractMedicalFindingsFlow',
    inputSchema: ExtractMedicalFindingsInputSchema,
    outputSchema: ExtractMedicalFindingsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
