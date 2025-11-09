import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME || "Submissions";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST() {
  try {
    console.log("🏗️ Building carousels automatically...");

    // --- Step 1: Fetch approved submissions
    const records = await base(TABLE)
      .select({
        filterByFormula: "AND(Status='Approved', NOT({AI_Theme}=''))",
        maxRecords: 100,
        sort: [{ field: "ViralityScore", direction: "desc" }],
      })
      .all();

    if (records.length === 0) {
      return NextResponse.json({ message: "No approved submissions found." });
    }

    // --- Step 2: Group by AI_Theme ---
    const grouped: Record<string, Airtable.Record<any>[]> = {};
    for (const rec of records) {
      const theme = rec.get("AI_Theme") || "Uncategorized";
      if (!grouped[theme]) grouped[theme] = [];
      grouped[theme].push(rec);
    }

    // --- Step 3: Process carousels (up to 20 slides each) ---
    const carousels = Object.entries(grouped).map(([theme, recs]) => ({
      id: `${theme}-${Date.now()}`,
      theme,
      records: recs.slice(0, 20),
    }));

    console.log(`🌀 Prepared ${carousels.length} carousels.`);

    // --- Step 4: Generate and upload images ---
    for (const carousel of carousels) {
      console.log(`🎨 Generating images for carousel: ${carousel.theme}`);

      for (const rec of carousel.records) {
        const id = rec.id;
        const idea = rec.get("Idea");
        const type = rec.get("Type");
        const mood = rec.get("Mood");
        const aiTheme = rec.get("AI_Theme");

        // Skip if already generated
        if (rec.get("GeneratedMedia")) continue;

        const prompt = `Create a visually striking Instagram-style image for the following post idea.
Theme: ${aiTheme || "General"}
Type: ${type}, Mood: ${mood}.
Idea: ${idea}`;

        try {
          const result = await openai.images.generate({
            model: "gpt-image-1",
            prompt,
            size: "1024x1024",
          });

          const b64 = result.data?.[0]?.b64_json;
          if (!b64) {
            console.warn(`⚠️ No image data returned for record ${id}`);
            continue;
          }

          // Upload to Cloudinary
          const uploadRes = await cloudinary.uploader.upload(
            `data:image/png;base64,${b64}`,
            { folder: "gramgenius_carousels" }
          );

          const imageUrl = uploadRes.secure_url;
          console.log(`✅ Uploaded image for ${id}: ${imageUrl}`);

          await base(TABLE).update([
            {
              id,
              fields: {
                GeneratedMedia: [{ url: imageUrl }],
                CarouselID: carousel.id,
              },
            },
          ]);

          console.log(`✅ Airtable updated for record ${id}`);
        } catch (err) {
          console.error(`❌ Failed for record ${id}:`, err);
        }
      }
    }

    return NextResponse.json({
      message: "Carousels built successfully with image uploads.",
    });
  } catch (error: any) {
    console.error("❌ buildCarousels error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
