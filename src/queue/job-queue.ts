import { processPlaylist, processSingleVideo } from "../services/processing.service.js";

export function enqueueJob(
  jobId: string,
  url: string,
  type: "playlist" | "video"
): void {
  // Simple in-process async queue — runs the job in the background
  // without blocking the Express request/response cycle.
  setImmediate(() => {
    const task = type === "video" ? processSingleVideo(jobId, url) : processPlaylist(jobId, url);
    task.catch((err) => {
      console.error(`Queue error for job ${jobId}:`, err);
    });
  });
}
