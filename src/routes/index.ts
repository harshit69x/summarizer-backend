import { Router } from "express";
import {
  processPlaylistController,
  processVideoController,
  getStatusController,
  getResultsController,
  getSavedJobsController,
  getProcessedVideoContentController,
  getProcessedVideosController,
} from "../controllers/playlist.controller.js";
import {
  syncUserController,
  getUserProfileController,
  saveSummaryController,
  getUserSummariesController,
  deleteSummaryController,
} from "../controllers/users.controller.js";

const router = Router();

// ── Video Processing Routes ────────────────────────────────
router.post("/process-playlist", processPlaylistController);
router.post("/process-video", processVideoController);
router.get("/status/:jobId", getStatusController);
router.get("/results/:jobId", getResultsController);
router.get("/saved-jobs", getSavedJobsController);
router.get("/processed-videos/:jobId", getProcessedVideosController);
router.get("/processed-videos/:jobId/:videoId", getProcessedVideoContentController);

// ── User Management Routes ─────────────────────────────────
router.post("/users/sync", syncUserController);
router.get("/users/:uid/profile", getUserProfileController);
router.post("/summaries", saveSummaryController);
router.get("/summaries", getUserSummariesController);
router.delete("/summaries/:summaryId", deleteSummaryController);

export default router;
