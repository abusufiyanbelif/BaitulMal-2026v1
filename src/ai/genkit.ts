import { genkit } from "@genkit-ai/core";
import { googleAI } from "@genkit-ai/google-genai";

/**
 * IMPORTANT RULES FOR THIS FILE:
 * 1. Do NOT import any flows here.
 * 2. This file ONLY initializes the `ai` object.
 * 3. All flows must import `ai` FROM this file.
 * 4. Do NOT use configureGenkit().
 */

const geminiApiKey = process.env.GEMINI_API_KEY;

// Warn early if key is missing (do not crash app)
if (!geminiApiKey) {
  console.warn(
    "⚠️ GEMINI_API_KEY is not set. AI features will not work. " +
    "Add it to .env.local for local dev or as a secret in Firebase App Hosting."
  );
}

// Always include the googleAI plugin.
// If apiKey is missing, it will throw ONLY when a flow is executed.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: geminiApiKey,
    }),
  ],
});
