/**
 * End-to-end smoke test for the VidSummarizer backend.
 *
 * Usage:  npx tsx scripts/test-e2e.ts [videoUrl]
 *
 * Default video: a short public YouTube video with captions.
 * The script will:
 *   1. POST /api/process-video  → create a job
 *   2. Poll  GET /api/status/:jobId until completed or failed
 *   3. GET   /api/results/:jobId  → print the generated notes
 */

const BASE = process.env.API_BASE ?? "http://localhost:3001";
const VIDEO_URL = process.argv[2] ?? "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 120; // 6 minutes max

async function main() {
  console.log("──────────────────────────────────────────");
  console.log("🧪  VidSummarizer E2E Test");
  console.log(`   Backend : ${BASE}`);
  console.log(`   Video   : ${VIDEO_URL}`);
  console.log("──────────────────────────────────────────\n");

  // ── Step 0: Health check ──────────────────────────────────
  console.log("▶ Step 0: Health check...");
  const healthRes = await fetch(`${BASE}/health`);
  if (!healthRes.ok) {
    console.error("❌ Health check failed:", healthRes.statusText);
    process.exit(1);
  }
  const health = await healthRes.json();
  console.log("✅ Server is healthy:", JSON.stringify(health));

  // ── Step 1: Submit video job ──────────────────────────────
  console.log("\n▶ Step 1: Submitting video for processing...");
  const submitRes = await fetch(`${BASE}/api/process-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: VIDEO_URL }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    console.error(`❌ Submit failed (${submitRes.status}):`, err);
    process.exit(1);
  }

  const { jobId } = (await submitRes.json()) as { jobId: string };
  console.log(`✅ Job created: ${jobId}`);

  // ── Step 2: Poll for completion ───────────────────────────
  console.log("\n▶ Step 2: Polling for completion...");
  let lastStatus = "";
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${BASE}/api/status/${jobId}`);
    if (!statusRes.ok) {
      console.error("❌ Status check failed:", statusRes.statusText);
      process.exit(1);
    }

    const statusData = (await statusRes.json()) as {
      status: string;
      progress?: { current?: number; total?: number };
      error?: string;
    };

    const statusLine = `   [${i + 1}/${MAX_POLLS}] Status: ${statusData.status}${
      statusData.progress
        ? ` (${statusData.progress.current ?? 0}/${statusData.progress.total ?? "?"})`
        : ""
    }`;

    if (statusData.status !== lastStatus) {
      console.log(statusLine);
      lastStatus = statusData.status;
    }

    if (statusData.status === "completed") {
      console.log("✅ Job completed!");
      break;
    }

    if (statusData.status === "failed") {
      console.error("❌ Job failed:", statusData.error);
      process.exit(1);
    }
  }

  // ── Step 3: Fetch results ─────────────────────────────────
  console.log("\n▶ Step 3: Fetching results...");
  const resultsRes = await fetch(`${BASE}/api/results/${jobId}`);
  if (!resultsRes.ok) {
    console.error("❌ Results fetch failed:", resultsRes.statusText);
    process.exit(1);
  }

  const results = await resultsRes.json();

  console.log("\n══════════════════════════════════════════");
  console.log("📝  GENERATED NOTES");
  console.log("══════════════════════════════════════════");

  if (results.videoDetails && results.videoDetails.length > 0) {
    for (const video of results.videoDetails) {
      console.log(`\n── ${video.title} ──`);
      console.log(`   Has transcript: ${video.hasTranscript}`);
      if (video.notes) {
        // Print first 500 chars of notes as preview
        const preview = video.notes.length > 500 ? video.notes.slice(0, 500) + "..." : video.notes;
        console.log(`\n${preview}`);
      }
    }
  } else {
    console.log(JSON.stringify(results, null, 2));
  }

  console.log("\n══════════════════════════════════════════");
  console.log("✅  E2E Test PASSED");
  console.log("══════════════════════════════════════════");
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(1);
});
