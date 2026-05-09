import type { Request, Response } from "express";
import { createJob, findIncompleteJobBySource, getJob } from "../store.js";
import { enqueueJob } from "../queue/job-queue.js";
import {
  getProcessedVideoContent,
  listPersistedJobs,
  type ProcessedVideoSummary,
  listProcessedVideoSummaries,
} from "../services/persistence.service.js";
import { normalizePlaylistUrl } from "../services/youtube.service.js";

function isPlaylistUrl(url: string): boolean {
  return url.includes("youtube.com/playlist") || url.includes("list=");
}

function isVideoUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/.test(
    url
  );
}

export function processPlaylistController(req: Request, res: Response): void {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "A valid playlist URL is required." });
    return;
  }

  if (!isPlaylistUrl(url)) {
    res
      .status(400)
      .json({ error: "URL does not appear to be a YouTube playlist." });
    return;
  }

  const normalizedUrl = normalizePlaylistUrl(url);
  void (async () => {
    const existing = await findIncompleteJobBySource("playlist", normalizedUrl);
    if (existing) {
      console.log(`♻ Resuming existing playlist job ${existing.jobId} for ${normalizedUrl}`);
      enqueueJob(existing.jobId, normalizedUrl, "playlist");
      res.status(201).json({ jobId: existing.jobId, resumed: true });
      return;
    }

    const jobId = createJob({ type: "playlist", url: normalizedUrl, title: normalizedUrl });
    enqueueJob(jobId, normalizedUrl, "playlist");
    res.status(201).json({ jobId, resumed: false });
  })().catch((error) => {
    const message = error instanceof Error ? error.message : "Failed to start playlist job.";
    res.status(500).json({ error: message });
  });
}

export function processVideoController(req: Request, res: Response): void {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "A valid YouTube video URL is required." });
    return;
  }

  if (!isVideoUrl(url)) {
    res
      .status(400)
      .json({ error: "URL does not appear to be a valid YouTube video." });
    return;
  }

  void (async () => {
    const existing = await findIncompleteJobBySource("video", url);
    if (existing) {
      console.log(`♻ Resuming existing video job ${existing.jobId} for ${url}`);
      enqueueJob(existing.jobId, url, "video");
      res.status(201).json({ jobId: existing.jobId, resumed: true });
      return;
    }

    const jobId = createJob({ type: "video", url, title: url });
    enqueueJob(jobId, url, "video");
    res.status(201).json({ jobId, resumed: false });
  })().catch((error) => {
    const message = error instanceof Error ? error.message : "Failed to start video job.";
    res.status(500).json({ error: message });
  });
}

export async function getStatusController(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const job = await getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  let processedVideos: ProcessedVideoSummary[] = [];
  try {
    processedVideos = await listProcessedVideoSummaries(jobId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`⚠ Failed to load processed videos for ${jobId}: ${message}`);
  }

  res.json({
    status: job.status,
    progress: job.progress,
    error: job.error,
    processedVideos,
  });
}

export async function getResultsController(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const job = await getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  if (job.status !== "completed") {
    if (job.result) {
      const processedVideos = await listProcessedVideoSummaries(jobId).catch(() => []);
      res.status(200).json({
        ...job.result,
        partial: true,
        videoDetails: processedVideos.map(pv => ({
          videoId: pv.videoId,
          title: pv.title,
          hasTranscript: pv.hasTranscript,
        })),
      });
      return;
    }

    res.status(202).json({
      message: "Job is still processing.",
      status: job.status,
      progress: job.progress,
    });
    return;
  }

  const processedVideos = await listProcessedVideoSummaries(jobId).catch(() => []);
  const videoDetails = [];
  for (const pv of processedVideos) {
    try {
      const content = await getProcessedVideoContent(jobId, pv.videoId);
      if (content) {
        videoDetails.push({
          videoId: content.videoId,
          title: content.title,
          hasTranscript: content.hasTranscript,
          notes: content.notes,
        });
      }
    } catch {
      // Silently skip videos that fail to load
    }
  }

  res.json({
    ...job.result,
    videoDetails,
  });
}

export async function getSavedJobsController(
  req: Request,
  res: Response
): Promise<void> {
  const rawLimit = req.query.limit;
  const parsedLimit =
    typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : 20;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 100)
    : 20;

  try {
    const jobs = await listPersistedJobs(limit);
    res.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch saved jobs.";
    res.status(500).json({ error: message });
  }
}

export async function getProcessedVideosController(
  req: Request,
  res: Response
): Promise<void> {
  const { jobId } = req.params;

  try {
    const videos = await listProcessedVideoSummaries(jobId);
    res.json({ videos });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch processed videos.";
    res.status(500).json({ error: message });
  }
}

export async function getProcessedVideoContentController(
  req: Request,
  res: Response
): Promise<void> {
  const { jobId, videoId } = req.params;

  try {
    const video = await getProcessedVideoContent(jobId, videoId);
    if (!video) {
      res.status(404).json({ error: "Processed video not found." });
      return;
    }

    res.json({
      videoId: video.videoId,
      title: video.title,
      hasTranscript: video.hasTranscript,
      transcript: video.transcript,
      notes: video.notes,
      updatedAt: video.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch processed video content.";
    res.status(500).json({ error: message });
  }
}
