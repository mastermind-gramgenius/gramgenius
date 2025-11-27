import { NextResponse } from "next/server";
import Airtable from "airtable";
import OpenAI from "openai";

export const runtime = "nodejs";

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Comfy endpoint (your RunPod URL)
const COMFY_ENDPOINT =
  process.env.COMFY_ENDPOINT ??
  "https://298abrecwwv1oj-8188.proxy.runpod.net";

// Small sleep helper
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call ComfyUI: simple SDXL workflow that always produces
 * a single 1024x1024 image. Returns raw image Buffer.
 *
 * This is the same logic we had when it was “almost working”,
 * but with a MUCH longer wait for history (up to 180 seconds).
 */
async function generateImageWithComfy(idea: string): Promise<Buffer> {
  const positivePrompt = `
Square Instagram image (1:1) inspired by this idea: "${idea}".
Highly engaging, eye-catching, but safe for all ages.
No text, no watermarks, no logos, no gore, no nudity.
High quality, detailed, colourful, clean composition.
`.trim();

  const negativePrompt = `
low quality, blurry, text, watermark, logo, nudity, nsfw, gore, violence,
distorted faces, extra limbs, deformed hands, creepy, horror
`.trim();

  // Minimal SDXL workflow (same as before)
  const workflow = {
    // 1: Checkpoint loader
    "1": {
      inputs: {
        ckpt_name: "sd_xl_base_1.0.safetensors",
      },
      class_type: "CheckpointLoaderSimple",
    },
    // 2: Positive text
    "2": {
      inputs: {
        text: positivePrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
    },
    // 3: Negative text
    "3": {
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
      class_type: "CLIPTextEncode",
    },
    // 4: Empty latent (1024x1024)
    "4": {
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
    },
    // 5: KSampler
    "5": {
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps: 24,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
      class_type: "KSampler",
    },
    // 6: Decode
    "6": {
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2],
      },
      class_type: "VAEDecode",
    },
    // 7: Save image
    "7": {
      inputs: {
        images: ["6", 0],
        filename_prefix: "youpost",
      },
      class_type: "SaveImage",
    },
  };

  // 1️⃣ Send prompt
  const promptRes = await fetch(`${COMFY_ENDPOINT}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!promptRes.ok) {
    const text = await promptRes.text().catch(() => "");
    throw new Error(
      `ComfyUI /prompt failed (${promptRes.status}): ${text || "no body"}`
    );
  }

  const promptJson: any = await promptRes.json();
  const promptId: string | undefined = promptJson.prompt_id;
  if (!promptId) {
    throw new Error("ComfyUI did not return a prompt_id.");
  }

  // 2️⃣ Poll history for up to 3 minutes (previously ~40s)
  let filename: string | null = null;
  let subfolder: string | null = null;
  let type: string = "output";

  const MAX_ATTEMPTS = 180; // 180 * 1s = 3 minutes
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await delay(1000);

    const histRes = await fetch(`${COMFY_ENDPOINT}/history/${promptId}`);
    if (!histRes.ok) continue;

    const histJson: any = await histRes.json();
    const entry = histJson?.[promptId];
    if (!entry || !entry.outputs) continue;

    // same node index as before: SaveImage node "7"
    const node7 = entry.outputs["7"];
    const images = node7?.images;
    if (Array.isArray(images) && images.length > 0) {
      filename = images[0].filename;
      subfolder = images[0].subfolder ?? "";
      type = images[0].type ?? "output";
      break;
    }
  }

  if (!filename) {
    throw new Error("ComfyUI history did not produce an image in time.");
  }

  // 3️⃣ Download bytes from /view
  const url =
    `${COMFY_ENDPOINT}/view?` +
    `filename=${encodeURIComponent(filename)}` +
    `&subfolder=${encodeURIComponent(subfolder || "")}` +
    `&type=${encodeURIComponent(type)}`;

  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    const text = await imgRes.text().catch(() => "");
    throw new Error(`/view failed (${imgRes.status}): ${text || "no body"}`);
  }

  const arrayBuf = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Upload Buffer to Cloudinary and return secure URL.
 */
async function uploadToCloudinary(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "youpost_generated",
          resource_type: "image",
        },
        (err: any, result: any) => {
          if (err) return reject(err);
          resolve(result.secure_url as string);
        }
      )
      .end(buffer);
  });
}

// --------------------------------------------------------
// POST /api/generateCarouselImages
// --------------------------------------------------------
export async function POST() {
  try {
    console.log("🎨 Starting image generation for next planned carousel...");

    // 1️⃣ Fetch all submissions with CarouselStatus = "Planned"
    const planned = await base(TABLE)
      .select({
        filterByFormula: `{CarouselStatus} = "Planned"`,
        maxRecords: 200,
      })
      .all();

    if (planned.length === 0) {
      return NextResponse.json({
        message: "No planned carousels found.",
      });
    }

    // 2️⃣ Group by CarouselID and pick oldest
    const carousels: Record<
      string,
      { records: any[]; earliestDate: Date }
    > = {};

    for (const rec of planned) {
      const cid = (rec.get("CarouselID") as string) || "unknown";
      const createdRaw =
        (rec.get("CreatedAt") as string) || new Date().toISOString();
      const createdAt = new Date(createdRaw);

      if (!carousels[cid]) {
        carousels[cid] = { records: [], earliestDate: createdAt };
      }
      carousels[cid].records.push(rec);
      if (createdAt < carousels[cid].earliestDate) {
        carousels[cid].earliestDate = createdAt;
      }
    }

    const carouselIds = Object.keys(carousels);
    if (carouselIds.length === 0) {
      return NextResponse.json({
        message: "No grouped carousels found.",
      });
    }

    carouselIds.sort(
      (a, b) =>
        carousels[a].earliestDate.getTime() -
        carousels[b].earliestDate.getTime()
    );

    const nextId = carouselIds[0];
    const { records } = carousels[nextId];

    console.log(
      `🎠 Generating images for carousel ${nextId}, ${records.length} slides`
    );

    const generatedUrls: string[] = [];

    // 3️⃣ For each record: reuse user upload OR generate via Comfy
    for (const rec of records) {
      const idea = (rec.get("Idea") as string) || "";
      const userMedia = (rec.get("UserMedia") as any[]) || [];

      try {
        let finalUrl: string;

        if (userMedia.length > 0 && userMedia[0]?.url) {
          // 🔁 user upload → reuse
          finalUrl = userMedia[0].url as string;
          console.log(`🖼️ Reusing user upload for record ${rec.id}`);
        } else {
          // 🎨 idea → generate via Comfy
          console.log(`🤖 Generating AI image for record ${rec.id}`);
          const imgBuffer = await generateImageWithComfy(idea);
          finalUrl = await uploadToCloudinary(imgBuffer);
          console.log(`✅ Generated & uploaded image for ${rec.id}`);
        }

        generatedUrls.push(finalUrl);
      } catch (err: any) {
        console.error(
          `❌ Failed to create image for record ${rec.id}:`,
          err?.message || err
        );
        generatedUrls.push("");
      }
    }

    // 4️⃣ Update Airtable
    for (let i = 0; i < records.length; i++) {
      const url = generatedUrls[i];
      if (!url) continue;

      await base(TABLE).update([
        {
          id: records[i].id,
          fields: {
            GeneratedImageURLs: url,
            CarouselStatus: "ReadyForPosting",
          },
        },
      ]);
    }

    return NextResponse.json({
      message: "Images generated successfully for one carousel.",
      carouselId: nextId,
      slideCount: records.length,
    });
  } catch (err: any) {
    console.error("❌ generateCarouselImages error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
