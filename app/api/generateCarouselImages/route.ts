import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";

export async function POST() {
  try {
    const nextToPost = await base(TABLE)
      .select({
        filterByFormula:
          "AND({CarouselStatus}='NextToPost', {Status}='Approved', OR({GeneratedMedia}='', NOT({GeneratedMedia})))",
        fields: ["Idea", "AI_Theme", "GeneratedMedia"],
        maxRecords: 50,
      })
      .all();

    if (!nextToPost.length)
      return NextResponse.json({ message: "No NextToPost records found." });

    console.log(`🖼 Generating ${nextToPost.length} images for NextToPost carousel...`);

    const updates: { id: string; fields: any }[] = [];

    for (const rec of nextToPost) {
      const idea = rec.get("Idea") as string;
      const theme = rec.get("AI_Theme") as string;
      const prompt = `Create a visually striking, Instagram-ready image illustrating the theme "${theme}" based on the idea: ${idea}. Maintain an aesthetic, high-contrast, meme/art friendly style.`;

      try {
        const img = await openai.images.generate({
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
        });
        const url = img.data?.[0]?.url;
        if (!url) continue;

        updates.push({
          id: rec.id,
          fields: { GeneratedMedia: [{ url }] },
        });

        console.log(`✅ Generated image for record ${rec.id}`);
      } catch (err: any) {
        console.error(`⚠️ Generation failed for ${rec.id}:`, err.message);
      }
    }

    if (updates.length) {
      // Batch update Airtable
      for (let i = 0; i < updates.length; i += 10) {
        await base(TABLE).update(updates.slice(i, i + 10));
      }
    }

    console.log(`🎨 Updated ${updates.length} records with generated images.`);
    return NextResponse.json({
      message: "Images generated for NextToPost carousel.",
      count: updates.length,
    });
  } catch (err: any) {
    console.error("❌ generateCarouselImages error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
