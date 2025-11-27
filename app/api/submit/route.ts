import Airtable from "airtable";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export const runtime = "nodejs";

// Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);
const TABLE = process.env.AIRTABLE_TABLE_NAME!;

// Cloudinary upload helper
const cloudinaryUpload = async (fileBuffer: Buffer) => {
  const cloudinary = require("cloudinary").v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise<string>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "youpost_uploads",
          resource_type: "image",
        },
        (error: any, result: any) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      )
      .end(fileBuffer);
  });
};

// ----------------------------------------------------
//  POST /api/submit
// ----------------------------------------------------
export async function POST(req: Request) {
  try {
    // 1️⃣ Require login
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: "You must be logged in to submit." },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // 2️⃣ Parse multipart form data
    const form = await req.formData();
    const idea = form.get("idea")?.toString() || "";
    const instagram = form.get("instagram")?.toString() || "";
    const mediaFile = form.get("userMedia") as File | null;

    // Require at least an idea or an image
    if (!idea && (!mediaFile || mediaFile.size === 0)) {
      return NextResponse.json(
        {
          error: "missing_content",
          message: "Please submit an idea, an image, or both.",
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

    // 3️⃣ Enforce daily submission limit (2/day per email)
    const submittedToday = await base(TABLE)
      .select({
        filterByFormula: `AND(
          {Email} = "${userEmail}",
          DATETIME_FORMAT({CreatedAt}, "YYYY-MM-DD") = "${today}"
        )`,
      })
      .all();

    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const nextMidnightISO = nextMidnight.toISOString();

    if (submittedToday.length >= 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "limit_reached",
          message: "You’ve reached your daily limit of 2 submissions.",
          nextAllowed: nextMidnightISO,
        },
        { status: 429 }
      );
    }

    // 4️⃣ Upload image to Cloudinary if present
    let uploadedImageUrl: string | undefined;

    if (mediaFile && mediaFile.size > 0) {
      const arrayBuffer = await mediaFile.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      uploadedImageUrl = await cloudinaryUpload(fileBuffer);
    }

    // 5️⃣ Prepare Airtable fields
    const fields: Record<string, any> = {
      Idea: idea || "",
      instagram: instagram || "",
      Email: userEmail,
      Status: "Pending",
      UserMedia: uploadedImageUrl ? [{ url: uploadedImageUrl }] : undefined,
    };

    // Clean undefined
    Object.keys(fields).forEach((k) => {
      if (fields[k] === undefined) delete fields[k];
    });

    // 6️⃣ Insert into Airtable
    const created = await base(TABLE).create([{ fields }]);

    return NextResponse.json(
      { message: "Submitted successfully!", recordId: created[0].id },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ Error submitting:", err);
    return NextResponse.json(
      { error: "Submission failed", detail: err.message },
      { status: 500 }
    );
  }
}
