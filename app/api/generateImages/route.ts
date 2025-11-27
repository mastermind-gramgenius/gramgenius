/*import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);

const generated = base(process.env.AIRTABLE_GENERATED_TABLE_NAME!);

export async function GET() {
  try {
    const records = await generated.select({
      filterByFormula: "AND({Status} = 'Pending', {Prompt} != '')",
      maxRecords: 5, // limit to avoid hitting API rate limits
    }).all();

    if (records.length === 0) {
      return NextResponse.json({ message: "No pending prompts found." });
    }

    for (const record of records) {
      const prompt = record.get("Prompt") as string;

      console.log(`🖼️ Generating image for prompt: ${prompt}`);

      // 1️⃣ Generate image from prompt
      const image = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      });

      const imageUrl = image.data[0].url;

      // 2️⃣ Update Airtable record
      await generated.update(record.id, {
        "Image URL": imageUrl,
        Status: "Generated",
      });
    }

    return NextResponse.json({ success: true, generated: records.length });
  } catch (err: any) {
    console.error("Error generating images:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
*/