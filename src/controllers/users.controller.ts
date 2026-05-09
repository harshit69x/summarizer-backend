import type { Request, Response } from "express";
import {
  syncOrCreateUser,
  getUserProfile,
  saveSummary,
  getUserSummaries,
  deleteSummary,
} from "../services/persistence.service.js";

export async function syncUserController(req: Request, res: Response): Promise<void> {
  try {
    const { uid, email, displayName, createdAt } = req.body;

    if (!uid || !email || !displayName) {
      res.status(400).json({ error: "uid, email, and displayName are required." });
      return;
    }

    await syncOrCreateUser({
      uid,
      email,
      displayName,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    });

    res.status(200).json({ message: "User synced successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync user.";
    res.status(500).json({ error: message });
  }
}

export async function getUserProfileController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { uid } = req.params;

    if (!uid) {
      res.status(400).json({ error: "uid is required." });
      return;
    }

    const profile = await getUserProfile(uid);

    if (!profile) {
      res.status(404).json({ error: "User profile not found." });
      return;
    }

    res.json(profile);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch user profile.";
    res.status(500).json({ error: message });
  }
}

export async function saveSummaryController(req: Request, res: Response): Promise<void> {
  try {
    const uid = req.get("x-user-uid");
    const { url, title, type, summary, keyPoints, keywords, videoCount } = req.body;

    if (!uid) {
      res.status(401).json({ error: "x-user-uid header is required." });
      return;
    }

    if (!url || !title || !type || !summary) {
      res.status(400).json({
        error: "url, title, type, and summary are required in request body.",
      });
      return;
    }

    const summaryId = await saveSummary(uid, {
      url,
      title,
      type,
      summary,
      keyPoints: keyPoints || [],
      keywords: keywords || [],
      videoCount: videoCount || 0,
      createdAt: new Date(),
    });

    res.status(201).json({ summaryId, message: "Summary saved successfully." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save summary.";
    res.status(500).json({ error: message });
  }
}

export async function getUserSummariesController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const uid = req.get("x-user-uid");
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!uid) {
      res.status(401).json({ error: "x-user-uid header is required." });
      return;
    }

    const summaries = await getUserSummaries(uid, limit);

    res.json({ summaries });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch user summaries.";
    res.status(500).json({ error: message });
  }
}

export async function deleteSummaryController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const uid = req.get("x-user-uid");
    const { summaryId } = req.params;

    if (!uid) {
      res.status(401).json({ error: "x-user-uid header is required." });
      return;
    }

    if (!summaryId) {
      res.status(400).json({ error: "summaryId is required." });
      return;
    }

    const deleted = await deleteSummary(uid, summaryId);

    if (!deleted) {
      res.status(404).json({ error: "Summary not found." });
      return;
    }

    res.json({ message: "Summary deleted successfully." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete summary.";
    res.status(500).json({ error: message });
  }
}
