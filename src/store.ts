import { v4 as uuidv4 } from "uuid";
import {
  findPersistedJobBySource,
  getPersistedJob,
  persistJob,
} from "./services/persistence.service.js";
import type { VideoInfo } from "./services/youtube.service.js";

export interface JobSource {
  type: "playlist" | "video";
  url: string;
  title: string;
}

export interface JobVideoResult {
  id: string;
  title: string;
  hasTranscript: boolean;
  transcript?: string;
  notes?: string;
}

export interface JobData {
  source: JobSource | null;
  playlistVideos: VideoInfo[];
  status: "queued" | "processing" | "completed" | "failed";
  progress: {
    current: number;
    total: number;
    currentVideo: string;
    phase: string;
    batchSize: number;
    batchCurrent: number;
    batchTotal: number;
    checkpointed: number;
    resumed: boolean;
  };
  result: JobResult | null;
  error: string | null;
  createdAt: Date;
}

export interface JobResult {
  playlistTitle: string;
  videoCount: number;
  notes: string;
  keyPoints: string;
  questions: string;
  videos: JobVideoResult[];
}

const jobs = new Map<string, JobData>();

function buildPersistPayload(job: JobData): Omit<
  import("./services/persistence.service.js").PersistedJobData,
  "jobId" | "updatedAt"
> {
  return {
    source: job.source,
    playlistVideos: job.playlistVideos,
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
  };
}

async function persistCurrentJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;

  await persistJob(id, buildPersistPayload(job));
}

export function createJob(source: JobSource | null = null): string {
  const id = uuidv4();
  jobs.set(id, {
    source,
    playlistVideos: [],
    status: "queued",
    progress: {
      current: 0,
      total: 0,
      currentVideo: "",
      phase: "Queued",
      batchSize: 0,
      batchCurrent: 0,
      batchTotal: 0,
      checkpointed: 0,
      resumed: false,
    },
    result: null,
    error: null,
    createdAt: new Date(),
  });

  const job = jobs.get(id);
  if (job) {
    void persistCurrentJob(id).catch((error) => {
      console.warn("⚠ Failed to persist queued job:", error);
    });
  }

  return id;
}

export async function getJob(id: string): Promise<JobData | undefined> {
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;

  try {
    const persisted = await getPersistedJob(id);
    if (!persisted) return undefined;

    const job: JobData = {
      source: persisted.source,
      playlistVideos: persisted.playlistVideos || [],
      status: persisted.status,
      progress: {
        current: persisted.progress.current,
        total: persisted.progress.total,
        currentVideo: persisted.progress.currentVideo,
        phase: persisted.progress.phase,
        batchSize: persisted.progress.batchSize || 0,
        batchCurrent: persisted.progress.batchCurrent || 0,
        batchTotal: persisted.progress.batchTotal || 0,
        checkpointed: persisted.progress.checkpointed || 0,
        resumed: persisted.progress.resumed || false,
      },
      result: persisted.result,
      error: persisted.error,
      createdAt: new Date(persisted.createdAt),
    };

    jobs.set(id, job);
    return job;
  } catch (error) {
    console.warn("⚠ Failed to load job from Mongo:", error);
    return undefined;
  }
}

export async function findIncompleteJobBySource(
  sourceType: "playlist" | "video",
  sourceUrl: string
): Promise<{ jobId: string; job: JobData } | null> {
  const persisted = await findPersistedJobBySource(sourceType, sourceUrl);
  if (!persisted) return null;

  const jobId = persisted.jobId;
  const existing = jobs.get(jobId);
  if (existing) {
    return { jobId, job: existing };
  }

  const job: JobData = {
    source: persisted.source,
    playlistVideos: persisted.playlistVideos || [],
    status: persisted.status,
    progress: {
      current: persisted.progress.current,
      total: persisted.progress.total,
      currentVideo: persisted.progress.currentVideo,
      phase: persisted.progress.phase,
      batchSize: persisted.progress.batchSize || 0,
      batchCurrent: persisted.progress.batchCurrent || 0,
      batchTotal: persisted.progress.batchTotal || 0,
      checkpointed: persisted.progress.checkpointed || 0,
      resumed: persisted.progress.resumed || false,
    },
    result: persisted.result,
    error: persisted.error,
    createdAt: new Date(persisted.createdAt),
  };

  jobs.set(jobId, job);
  return { jobId, job };
}

export function updateJobProgress(
  id: string,
  progress: Partial<JobData["progress"]>
) {
  const job = jobs.get(id);
  if (job) {
    job.status = "processing";
    job.progress = { ...job.progress, ...progress };

    void persistCurrentJob(id).catch((error) => {
      console.warn("⚠ Failed to persist in-progress job:", error);
    });
  }
}

export function updateJobCheckpoint(
  id: string,
  patch: Partial<Pick<JobData, "source" | "playlistVideos" | "result" | "error" | "status">> & {
    progress?: Partial<JobData["progress"]>;
  }
) {
  const job = jobs.get(id);
  if (!job) return;

  if (typeof patch.status !== "undefined") {
    job.status = patch.status;
  }
  if (typeof patch.source !== "undefined") {
    job.source = patch.source;
  }
  if (typeof patch.playlistVideos !== "undefined") {
    job.playlistVideos = patch.playlistVideos;
  }
  if (typeof patch.result !== "undefined") {
    job.result = patch.result;
  }
  if (typeof patch.error !== "undefined") {
    job.error = patch.error;
  }
  if (patch.progress) {
    job.progress = { ...job.progress, ...patch.progress };
  }

  void persistCurrentJob(id).catch((error) => {
    console.warn("⚠ Failed to persist job checkpoint:", error);
  });
}

export function completeJob(id: string, result: JobResult) {
  const job = jobs.get(id);
  if (job) {
    job.status = "completed";
    job.result = result;
    job.progress.phase = "Completed";

    void persistCurrentJob(id).catch((error) => {
      console.warn("⚠ Failed to persist completed job:", error);
    });
  }
}

export function failJob(id: string, error: string) {
  const job = jobs.get(id);
  if (job) {
    job.status = "failed";
    job.error = error;
    job.progress.phase = "Failed";

    void persistCurrentJob(id).catch((persistError) => {
      console.warn("⚠ Failed to persist failed job:", persistError);
    });
  }
}
