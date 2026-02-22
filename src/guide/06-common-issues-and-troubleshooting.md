# 6. Common Issues & Troubleshooting

This guide provides solutions to common problems you might encounter during development.

## Table of Contents

-   [Build Failure: "404 Not Found" on Startup](#build-failure-404-not-found-on-startup)
-   [Runtime Error: `useFirebase must be used within FirebaseProvider`](#runtime-error-usefirebase-must-be-used-within-firebaseprovider)
-   [Permissions Error: "Missing or insufficient permissions"](#permissions-error-missing-or-insufficient-permissions)
-   [AI / Genkit Error: "API key not valid"](#ai--genkit-error-api-key-not-valid)
-   [General Debugging Steps](#general-debugging-steps)

## Build Failure: "404 Not Found" on Startup

If the application shows a "404 Not Found" page immediately after starting the development server (`npm run dev`), it means the Next.js build failed. This is almost always caused by TypeScript errors.

**Solution:**

1.  **Check the Terminal**: Look at the terminal where you ran `npm run dev`. Scroll up to find the TypeScript error messages (they usually start with `⨯`).
2.  **Address the Errors**: The errors will point to specific files and lines. Common causes include:
    -   `Could not find a declaration file for module...`: This often points to an issue in your `tsconfig.json`. Ensure the `include` and `paths` are configured correctly.
    -   `Property '...' does not exist on type '...'`: This is a type mismatch. Ensure the data you're passing matches the type definition.
    -   `Argument of type '...' is not assignable to parameter of type '...'`: Similar to the above, check that function arguments match the expected types.

## Runtime Error: `useFirebase must be used within FirebaseProvider`

-   **Cause**: A component or hook is trying to access the Firebase context before it's available. This often happens due to module resolution issues with Next.js and "barrel" file exports (`index.ts`). A component that is supposed to be client-only might be getting partially executed on the server.
-   **Solution**:
    1.  Identify the component throwing the error from the call stack.
    2.  Check its imports. If it's importing a hook (like `useUser`, `useFirestore`) from a central barrel file (e.g., `@/firebase`), change the import to point directly to the hook's source file.
    -   **Example**: Change `import { useUser } from '@/firebase';` to `import { useUser } from '@/firebase/auth/use-user';`.

## Permissions Error: "Missing or insufficient permissions"

This error appears in the browser console when Firestore or Storage security rules block an action.

**Solution:**

1.  **Open Developer Console**: The error message in the console is detailed and will tell you exactly what operation (`get`, `list`, `create`, etc.) on which path (`/users/some-id/...`) was denied.
2.  **Review `firestore.rules` or `storage.rules`**: Open the relevant rules file.
3.  **Find the Matching Rule**: Locate the `match` block that corresponds to the path in the error.
4.  **Analyze the `allow` Condition**:
    -   Is the user authenticated? (`isSignedIn()`)
    -   Is the user the owner of the document? (`isOwner(userId)`)
    -   Does the user have the Admin role? (`isAdmin()`)
    -   Is the incoming data valid? (e.g., `isDocumentDataConsistent()`)
5.  **Use the Diagnostics Page**: Navigate to `/diagnostics` in the app. The tests for Firestore Connectivity and Admin User records can help pinpoint rule-related issues.

## AI / Genkit Error: "API key not valid" or "Permission denied"

-   **Cause**: Issues with your `GEMINI_API_KEY` or Google Cloud project settings.
-   **Solution**: Refer to the troubleshooting section in the [Genkit AI Flows guide](./05-genkit-ai-flows.md#troubleshooting-ai-errors) for detailed steps on how to fix API key and enablement issues.

## General Debugging Steps

1.  **Check Server Logs**: The terminal where you ran `npm run dev` contains valuable server-side logs and error messages.
2.  **Check Browser Console**: The browser's developer console is essential for debugging client-side errors, including permission issues and component lifecycle problems.
3.  **Use the Diagnostics Page**: The `/diagnostics` page is your first stop for checking if core services (Firebase, Genkit) are configured and reachable.

---

[**◄ Back to Index**](../README.md)
