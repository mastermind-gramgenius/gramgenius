import { NextResponse } from "next/server";

export async function POST() {
  const podId = process.env.RUNPOD_POD_ID!;
  const apiKey = process.env.RUNPOD_API_KEY!;

  const result = await fetch(`https://api.runpod.io/v2/${podId}/stop`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }
  });

  return NextResponse.json(await result.json());
}
