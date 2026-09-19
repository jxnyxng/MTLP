import test from "node:test";
import assert from "node:assert/strict";
import { createGeminiClient } from "../src/services/gemini-client.js";

test("Gemini client keeps API keys inside native commands", async () => {
  const calls = [];
  const client = createGeminiClient(async (command, args) => {
    calls.push({ command, args });
    if (command === "has_gemini_api_key") return true;
    if (command === "generate_gemini_review") return { summary: "s", feedback: "f", nextAction: "n" };
  });
  await client.saveApiKey("secret");
  assert.equal(await client.hasApiKey(), true);
  assert.deepEqual(await client.generateReview("prompt"), { summary: "s", feedback: "f", nextAction: "n" });
  assert.deepEqual(calls, [
    { command: "save_gemini_api_key", args: { apiKey: "secret" } },
    { command: "has_gemini_api_key", args: undefined },
    { command: "generate_gemini_review", args: { prompt: "prompt" } },
  ]);
});
