import { GoogleGenAI } from '@google/genai';

// Requires GEMINI_API_KEY to be set in environment variables
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    customFetch: (url: any, init: any) => fetch(url, { ...init, cache: 'no-store', keepalive: false } as any)
  } as any
});

export function cleanGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  const newSchema = { ...schema };
  delete newSchema.$schema;
  delete newSchema.$id;
  delete newSchema.title;
  delete newSchema.default;

  // Gemini does not support 'const', use 'enum' instead
  if ('const' in newSchema) {
    newSchema.enum = [newSchema.const];
    delete newSchema.const;
  }

  if (newSchema.type === 'object') {
    newSchema.additionalProperties = false;
    if (newSchema.properties) {
      for (const key in newSchema.properties) {
        newSchema.properties[key] = cleanGeminiSchema(newSchema.properties[key]);
      }
    }
    // ensure all properties are required
    if (newSchema.properties && !newSchema.required) {
      newSchema.required = Object.keys(newSchema.properties);
    }
  }

  if (newSchema.type === 'array' && newSchema.items) {
    newSchema.items = cleanGeminiSchema(newSchema.items);
  }

  return newSchema;
}

export async function callGeminiWithRetry(params: any, retries = 5): Promise<string> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await ai.models.generateContent({
        model: params.model,
        contents: params.contents,
        config: params.config
      });
      return response.text || '';
    } catch (error: any) {
      const isRateLimit = error.status === 429;
      const isServerError = error.status >= 500;
      const isNetworkError = error.message?.includes('fetch failed') || error.message?.includes('ECONNRESET') || error.message?.includes('ETIMEDOUT') || error.cause?.code === 'ECONNRESET' || error.name === 'TypeError';
      
      if (isRateLimit || isServerError || isNetworkError) {
        attempt++;
        let waitTime = isRateLimit ? 10000 : 2000 * Math.pow(2, attempt - 1); // Exponential backoff for network/server errors
        
        // When processing very long transcripts, Google's API or Next.js occasionally drops the connection (ECONNRESET) mid-flight.
        // We log it as a warning, but the retry logic usually catches it and successfully resumes the segmentation.
        const errorType = isRateLimit ? 'Rate Limit' : (isServerError ? 'Server Error' : 'Connection Reset');
        console.warn(`[Gemini API Info] ${errorType} (${error.name}: ${error.message}). Retrying ${attempt}/${retries} in ${waitTime / 1000}s... (This is normal for large documents)`);
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded for Gemini API');
}
