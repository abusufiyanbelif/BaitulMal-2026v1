'use server';
/**
 * @fileOverview AI flow to extract structured data from an educational document image.
 *
 * - extractEducationFindings - Function to extract educational details from an image.
 * - ExtractEducationFindingsInput - Input type for extractEducationFindings.
 * - ExtractEducationFindingsOutput - Output type for extractEducationFindings.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const ExtractEducationFindingsInputSchema = z.object({
  reportDataUri: z
    .string()
    .describe(
      "An image of an educational document as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export type ExtractEducationFindingsInput = z.infer<typeof ExtractEducationFindingsInputSchema>;

const AchievementSchema = z.object({
    achievement: z.string().describe('A specific achievement, grade, or score from the document.'),
    details: z.string().describe('Any relevant details, dates, or notes about the achievement.'),
});

const ExtractEducationFindingsOutputSchema = z.object({
  institution: z.string().describe('The name of the educational institution.'),
  degree: z.string().describe('The degree, course, or examination name.'),
  achievements: z.array(AchievementSchema).describe('A structured list of key achievements, scores, or grades.'),
});

export type ExtractEducationFindingsOutput = z.infer<typeof ExtractEducationFindingsOutputSchema>;

export async function extractEducationFindings(
  input: ExtractEducationFindingsInput
): Promise<ExtractEducationFindingsOutput> {
  return extractEducationFindingsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractEducationFindingsPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ExtractEducationFindingsInputSchema },
  output: { schema: ExtractEducationFindingsOutputSchema },
  prompt: `You are an expert academic registrar tasked with extracting key information from an image of an educational document.

  Analyze the provided image and extract the institution name, degree/examination, and key achievements or grades.

  Here is the image from the educational document:
  ---
  Image: {{media url=reportDataUri}}
  ---

  Ensure that the extracted information is accurate and comprehensive.
`,
});

const extractEducationFindingsFlow = ai.defineFlow(
  {
    name: 'extractEducationFindingsFlow',
    inputSchema: ExtractEducationFindingsInputSchema,
    outputSchema: ExtractEducationFindingsOutputSchema,
  },
  async (input: ExtractEducationFindingsInput) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
