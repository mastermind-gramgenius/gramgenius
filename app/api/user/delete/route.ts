import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import Airtable from "airtable";

const prisma = new PrismaClient();

const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(
  process.env.AIRTABLE_BASE_ID!
);

const SUBMISSIONS_TABLE = process.env.AIRTABLE_TABLE_NAME!; 
//const CAROUSEL_TABLE = process.env.AIRTABLE_CAROUSEL_TABLE_NAME ?? "Carousels"; 

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = session.user.email;

  try {
    // 1️⃣ Delete user submissions in Airtable
    const submissions = await base(SUBMISSIONS_TABLE)
      .select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 200,
      })
      .all();

    // Destroy submissions in batches of 10
    for (let i = 0; i < submissions.length; i += 10) {
      await base(SUBMISSIONS_TABLE).destroy(
        submissions.slice(i, i + 10).map((r) => r.id)
      );
    }

   /* // 2️⃣ Remove the user from "Credits" fields of carousel items
    const carousels = await base(CAROUSEL_TABLE)
      .select({
        filterByFormula: `SEARCH("${email}", ARRAYJOIN({CreditsEmail} & ""))`,
      })
      .all();

    for (const c of carousels) {
      const credits = c.get("CreditsEmail") || [];
      const filtered = credits.filter((e: string) => e !== email);

      await base(CAROUSEL_TABLE).update([
        {
          id: c.id,
          fields: {
            CreditsEmail: filtered,
          },
        },
      ]);
    }*/

    // 3️⃣ Delete user from Prisma (cascades Sessions + Accounts)
    await prisma.user.delete({
      where: { email },
    });

    return NextResponse.json({
      success: true,
      deletedSubmissions: submissions.length,
     // cleanedCarousels: carousels.length,
    });
  } catch (error: any) {
    console.error("User deletion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
