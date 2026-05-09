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

const router = Router();

router.post("/process-playlist", processPlaylistController);
router.post("/process-video", processVideoController);
router.get("/status/:jobId", getStatusController);
router.get("/results/:jobId", getResultsController);
router.get("/saved-jobs", getSavedJobsController);
router.get("/processed-videos/:jobId", getProcessedVideosController);
router.get("/processed-videos/:jobId/:videoId", getProcessedVideoContentController);

export default router;
