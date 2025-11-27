// /api/runpod/start.ts
import { NextResponse } from "next/server";

export async function POST() {
  const podId = process.env.RUNPOD_POD_ID!;
  const apiKey = process.env.RUNPOD_API_KEY!;

  // 1. Start pod
  await fetch(`https://api.runpod.io/v2/${podId}/start`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    }
  });

  // 2. Poll until pod ready
  const deadline = Date.now() + 1000 * 60 * 5; // 5 min timeout

  while (true) {
    const statusRes = await fetch(`https://api.runpod.io/v2/${podId}/status`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });

    const statusJson = await statusRes.json();
    const phase = statusJson.pod.status.phase;

    console.log("Pod phase:", phase);

    if (phase === "RUNNING") {
      return NextResponse.json({ ready: true });
    }

    if (Date.now() > deadline) {
      return NextResponse.json({ error: "Timeout waiting for RUNNING" }, { status: 500 });
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}
