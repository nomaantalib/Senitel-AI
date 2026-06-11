import * as dotenv from 'dotenv';
dotenv.config();

const DEFAULT_FALLBACK_KEY = process.env.FALLBACK_GEMINI_API_KEY || '';

export interface GenerateResponse {
  text: string;
  modelUsed: string;
  keyUsed: string;
  error?: string;
}

export class GeminiService {
  private static models = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  /**
   * Generates content using the Gemini REST API.
   * Implements fallback key rotation and model rotation on failure.
   */
  public static async generateContent(
    prompt: string,
    systemPrompt: string = '',
    customApiKey?: string
  ): Promise<GenerateResponse> {
    const primaryKey = customApiKey || process.env.GEMINI_API_KEY || '';
    
    // Ordered list of keys to try: primary (if exists), then fallback
    const keysToTry = [primaryKey, DEFAULT_FALLBACK_KEY].filter(k => !!k);
    
    let lastError: Error | null = null;

    // Try keys in order
    for (const key of keysToTry) {
      const isFallback = key === DEFAULT_FALLBACK_KEY;
      const keyLabel = isFallback ? 'Default Fallback API Key' : 'User/Primary API Key';

      // Try models in order for this key
      for (const model of this.models) {
        try {
          console.log(`[GeminiService] Attempting LLM call using model: ${model} with ${keyLabel}`);
          const response = await this.callGeminiApi(model, prompt, systemPrompt, key);
          
          if (response) {
            return {
              text: response,
              modelUsed: model,
              keyUsed: isFallback ? 'Fallback Key (...f8aefo)' : 'Primary Configured Key'
            };
          }
        } catch (error: any) {
          console.warn(`[GeminiService] Failed with model ${model} and ${keyLabel}:`, error.message || error);
          lastError = error;
        }
      }
    }

    // If all failed, return a structured error with helpful context
    return {
      text: 'Error: Unable to process LLM request after attempting fallback keys and model types.',
      modelUsed: 'N/A',
      keyUsed: 'N/A',
      error: lastError?.message || 'Unknown network error'
    };
  }

  private static async callGeminiApi(
    model: string,
    prompt: string,
    systemPrompt: string,
    apiKey: string
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody: any = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    };

    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [
          {
            text: systemPrompt
          }
        ]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json() as any;
    
    // Safely extract candidate text response
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('Invalid response payload layout received from Gemini API');
  }
}
