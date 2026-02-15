# 5. Genkit AI Flows

The application uses **Genkit**, a framework from Firebase, to integrate with generative AI models like Google's Gemini. This allows for powerful features like text extraction (OCR), data structuring, and content generation.

## Overview of Genkit

-   **Flows**: A flow is an end-to-end function that orchestrates calls to AI models, tools, and other logic. All AI flows in this project are located in `src/ai/flows/`.
-   **Models**: The specific AI model (e.g., `gemini-1.5-flash-latest`) is defined within the flow.
-   **Prompts**: Prompts instruct the AI on what task to perform. They can include context, instructions, and data (like images).
-   **Schemas (Zod)**: We use [Zod](https://zod.dev/) to define the expected structure of the input to a flow and the desired structure of the output from the AI. This ensures type safety and predictable results.

## Anatomy of an AI Flow

Let's look at `src/ai/flows/extract-text.ts` as an example.

1.  **`'use server';`**: This Next.js directive marks the file as a Server Action, meaning it will only run on the server.
2.  **Input/Output Schemas**:
    -   `ExtractAndCorrectTextInputSchema`: Defines that the flow expects a single `photoDataUri` which is a string.
    -   `ExtractAndCorrectTextOutputSchema`: Defines that the flow expects the AI to return an object with a single `extractedText` string.
3.  **Prompt Definition (`ai.definePrompt`)**:
    -   This is where the magic happens. We define a prompt that tells the Gemini model its role ("You are an OCR... expert") and what to do ("Extract all text from the following image.").
    -   The `{{media url=photoDataUri}}` is Handlebars syntax that injects the uploaded image into the prompt.
4.  **Flow Definition (`ai.defineFlow`)**:
    -   This wraps the prompt call. It takes the input, passes it to the prompt, and returns the AI's output.
5.  **Exported Function**:
    -   A simple async wrapper function (e.g., `extractAndCorrectText`) is exported. This is the function that the client-side UI calls.

## Creating a New AI Flow

To add a new AI capability:

1.  Create a new file in `src/ai/flows/`, for example, `summarizeDocument.ts`.
2.  Add the `'use server';` directive at the top.
3.  Import `ai` from `@/ai/genkit` and `z` from `genkit`.
4.  Define your input and output schemas using `z.object({...})`.
5.  Define your prompt using `ai.definePrompt`, providing clear instructions and referencing your input schema fields.
6.  Define your flow using `ai.defineFlow` that calls the prompt.
7.  Export a simple async wrapper function that calls your flow.
8.  Create a corresponding API route in `src/app/api/` (e.g., `src/app/api/summarize-document/route.ts`) that calls your new exported function.

## Troubleshooting AI Errors

**Error: "API key not valid"**
-   **Cause**: Your `GEMINI_API_KEY` is missing, incorrect, or has restrictions.
-   **Solution**:
    1.  Ensure you have a `GEMINI_API_KEY="..."` entry in your `.env` file.
    2.  Verify the key is correct by checking it in [Google AI Studio](https://aistudio.google.com/app/apikey).
    3.  Make sure the key doesn't have any domain or IP restrictions that would prevent it from working on `localhost` or your deployed app.

**Error: "Permission denied" or "API not enabled"**
-   **Cause**: The "Generative Language API" (also known as the Gemini API) is not enabled for your Google Cloud project.
-   **Solution**:
    1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
    2.  Select the project associated with your Firebase project.
    3.  Navigate to "APIs & Services" > "Library".
    4.  Search for "Generative Language API" or "Gemini API" and click **Enable**.

**Error: "Model not found"**
-   **Cause**: The model name specified in `ai.definePrompt` is incorrect or not available for your project/region.
-   **Solution**: Check the [Google AI documentation](https://ai.google.dev/models/gemini) for the latest available model names (e.g., `googleai/gemini-1.5-flash-latest`).

---

[**◄ Back to Index**](../README.md) | [**Next: Common Issues & Troubleshooting ►**](./06-common-issues-and-troubleshooting.md)
