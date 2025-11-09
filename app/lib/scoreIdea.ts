import OpenAI from "openai";
import Airtable from "airtable";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);
const table = base(process.env.AIRTABLE_TABLE_NAME!);

export async function scoreIdea(recordId: string, idea: string) {
  try {
    const prompt = `You are helping pick Instagram content ideas. 
Rate this idea from 0–100 for engagement potential and assign a short theme.
Respond as JSON like this: {"score": 87, "theme": "Meme"}

Idea: ${idea}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0].message?.content ?? "";
    const match = content.match(/"score":\s*(\d+).*"theme":\s*"([^"]+)"/);
    const score = match ? parseInt(match[1]) : 50;
    const theme = match ? match[2] : "Generic";

    await table.update(recordId, {
      AI_Score: score,
      AI_Theme: theme,
      Status: "Scored",
    });

    console.log(`✅ Scored idea "${idea}" → ${score} (${theme})`);
  } catch (err) {
    console.error("❌ Error scoring idea:", err);
  }
}
