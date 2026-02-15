'use server';
/**
 * @fileOverview AI flow to create an academic summary from multiple education-related documents.
 *
 * - createEducationStory - Function to create an academic story.
 * - CreateEducationStoryInput - Input type for createEducationStory.
 * - CreateEducationStoryOutput - Output type for createEducationStory.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const CreateEducationStoryInputSchema = z.object({
  reportDataUris: z
    .array(z.string())
    .describe(
      "A list of educational documents (e.g., transcripts, certificates) as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});

export type CreateEducationStoryInput = z.infer<typeof CreateEducationStoryInputSchema>;

const CreateEducationStoryOutputSchema = z.object({
  story: z.string().describe('A summary of the student\'s academic journey and achievements based on the provided documents.'),
  isCorrectType: z.boolean().describe('A flag indicating if the uploaded documents appear to be of the correct type (educational).'),
});

export type CreateEducationStoryOutput = z.infer<typeof CreateEducationStoryOutputSchema>;

export async function createEducationStory(
  input: CreateEducationStoryInput
): Promise<CreateEducationStoryOutput> {
  return createEducationStoryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'createEducationStoryPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: CreateEducationStoryInputSchema },
  output: { schema: CreateEducationStoryOutputSchema },
  prompt: `You are an expert academic advisor. Your goal is to create a concise summary of a student's academic journey. First, determine if the documents appear to be educational (transcripts, mark sheets, certificates, etc.).

If the documents are not educational, create a general summary of their content.

Analyze the following documents and generate a summary that highlights key achievements, academic progression, and areas of focus.

Documents:
  {{#each reportDataUris}}
  Document: {{media url=this}}
  {{/each}}
`,
});

const createEducationStoryFlow = ai.defineFlow(
  {
    name: 'createEducationStoryFlow',
    inputSchema: CreateEducationStoryInputSchema,
    outputSchema: CreateEducationStoryOutputSchema,
  },
  async (input: CreateEducationStoryInput) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    return output;
  }
);
