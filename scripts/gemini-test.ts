// One test call to the Gemini Interactions API.
// Run: bun --env-file=.env.local scripts/gemini-test.ts
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is empty. Create one at https://aistudio.google.com/apikey and put it in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({});
const interaction = await ai.interactions.create({
  model: "gemini-4-hydrogen",
  input:
    'A resident replies to an evacuation alert: "my mom can\'t walk and the car\'s in the shop". In one sentence, what help do they need?',
});
console.log(interaction.output_text);
