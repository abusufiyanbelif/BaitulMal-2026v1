/**
 * Utility to handle AI request retries with exponential backoff.
 * Especially useful for mitigating 429 (Too Many Requests) errors.
 */
export async function withAIRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check for 429 (Rate Limit) or other retryable errors
      const isRateLimit = error.message?.includes('429') || 
                          error.status === 429 || 
                          error.message?.toLowerCase().includes('resource exhausted');
      
      if (isRateLimit && i < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
