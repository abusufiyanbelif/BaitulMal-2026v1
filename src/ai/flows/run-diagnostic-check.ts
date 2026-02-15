'use server';
/**
 * @fileOverview A simple AI flow to test Genkit connectivity.
 *
 * - runDiagnosticCheck - Function to check Gemini API connectivity.
 */
import {ai} from '@/ai/genkit';
import {z} from 'zod';

const RunDiagnosticOutputSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
});

export type RunDiagnosticOutput = z.infer<typeof RunDiagnosticOutputSchema>;

// This is the exported async function that the client will call.
export async function runDiagnosticCheck(): Promise<RunDiagnosticOutput> {
  // We don't need any input for this check
  return runDiagnosticCheckFlow();
}

// This is the internal Genkit flow. It is not exported.
const runDiagnosticCheckFlow = ai.defineFlow(
  {
    name: 'runDiagnosticCheckFlow',
    outputSchema: RunDiagnosticOutputSchema,
  },
  async (): Promise<RunDiagnosticOutput> => {
    try {
        const response = await ai.generate({
            model: 'googleai/gemini-1.5-flash-latest',
            prompt: 'Reply with only the word: "OK"',
            config: {
                temperature: 0,
            }
        });
        
        const text = response.text.trim();
        if (text === 'OK') {
            return { ok: true, message: 'Successfully received a valid response from the Gemini model.' };
        } else {
            return { ok: false, message: `Received an unexpected response: "${text}"` };
        }
    } catch (error: any) {
        console.error("Genkit Diagnostics Check Failed:", error);
        
        let clientMessage = `An unexpected error occurred: ${error.message}`;
        if (error.message) {
            const lowerCaseMessage = error.message.toLowerCase();
            if (lowerCaseMessage.includes('api key not valid')) {
                clientMessage = "The configured API key is not valid. Please ensure you have a valid GEMINI_API_KEY set in your .env file.";
            } else if (lowerCaseMessage.includes('permission denied')) {
                 clientMessage = 'API permission denied. This usually means the "Generative Language API" is not enabled for your project in the Google Cloud Console, or your API key has restrictions.';
            } else if (lowerCaseMessage.includes('not_found') || lowerCaseMessage.includes('not found') || lowerCaseMessage.includes('404')) {
                clientMessage = `Model not found. This can be caused by several issues: 1) The model name in the code is incorrect (it should be a format like 'googleai/gemini-pro-vision'). 2) The "Generative Language API" is not enabled in your Google Cloud project. 3) Your API key may have restrictions. Please check your GEMINI_API_KEY and Google Cloud project configuration. (Details: ${error.message})`;
            } else if (lowerCaseMessage.includes('a "use server" file can only export async functions')) {
                 clientMessage = 'A "use server" file can only export async functions, found object. Read more: https://nextjs.org/docs/messages/invalid-use-server-value';
            }
        }
        
        if (clientMessage.toLowerCase().includes('api key')) {
            clientMessage += " Your application is configured to check for 'GEMINI_API_KEY' in your .env file."
        }

        return { ok: false, message: clientMessage };
    }
  }
);
