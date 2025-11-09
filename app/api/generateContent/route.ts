import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID!);
const carousels = base(process.env.AIRTABLE_CAROUSELS_TABLE_NAME!);
const generated = base(process.env.AIRTABLE_GENERATED_TABLE_NAME!); // e.g. "GeneratedContent"
const ideas = base(process.env.AIRTABLE_TABLE_NAME!);

export async function GET() {
  try {
    // 1️⃣ Fetch carousels with no generated content yet
    const carouselRecords = await carousels.select({
      filterByFormula: "NOT({Theme} = '')"
    }).all();

    for (const carousel of carouselRecords) {
      const carouselId = carousel.id;
      const theme = carousel.get("Theme") as string;
      const ideaIds = (carousel.get("Ideas") as string[]) || [];

      // 2️⃣ Fetch ideas text
      const ideaRecords = await Promise.all(
        ideaIds.map(async (id) => {
          try {
            return await ideas.find(id);
          } catch {
            return null;
          }
        })
      );

      const ideaTexts = ideaRecords
        .filter((r): r is Airtable.Record<FieldSet> => r !== null)
        .map((r) => r.get("Idea"))
        .filter(Boolean)
        .join("\n- ");

      // 3️⃣ Generate prompts and caption via OpenAI
      const prompt = `You are a creative strategist working for an Instagram growth brand.
Each carousel should have one slide per idea submitted.
Theme: "${theme}"

Here are the user ideas:
${ideaTexts}

For each idea, generate ONE slide prompt describing the image or meme that should represent that idea.
Also generate:
- One catchy Instagram caption for the whole carousel.
- 3 to 6 relevant hashtags.

Return the result as strict JSON:
{
  "caption": "...",
  "hashtags": ["#...", "#..."],
  "slides": [
    { "idea": "...", "prompt": "..." },
    ...
  ]
}`;


      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = JSON.parse(response.choices[0].message.content || "{}");
      const slides = content.slides || [];

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        await generated.create([
          {
            fields: {
              Carousel: [carouselId],
              "Slide #": i + 1,
              Prompt: slide.prompt,
              Caption: i === 0 ? content.caption : undefined,
              Hashtags: i === 0 ? (content.hashtags || []).join(" ") : undefined,
              Status: "Pending",
            },
          },
        ]);
      }

    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error generating content:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
