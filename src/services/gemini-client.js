import { invoke } from "@tauri-apps/api/core";

export function createGeminiClient(invokeImpl = invoke) {
  return {
    saveApiKey: (apiKey) => invokeImpl("save_gemini_api_key", { apiKey }),
    hasApiKey: () => invokeImpl("has_gemini_api_key"),
    generateReview: (prompt) => invokeImpl("generate_gemini_review", { prompt }),
  };
}

export const geminiClient = createGeminiClient();
