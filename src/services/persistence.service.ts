import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

export interface PersistedJobData {
  jobId: string;
  source: {
    type: "playlist" | "video";
    url: string;
    title: string;
  } | null;
  playlistVideos: {
    id: string;
    title: string;
    url: string;
  }[];
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
  result: {
    playlistTitle: string;
    videoCount: number;
    notes: string;
    keyPoints: string;
    questions: string;
    videos: {
      id: string;
      title: string;
      hasTranscript: boolean;
      transcript?: string;
      notes?: string;
    }[];
  } | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedJobSummary {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  title: string;
  videoCount: number;
  updatedAt: Date;
}

export interface PersistedProcessedVideo {
  jobId: string;
  videoId: string;
  title: string;
  order: number;
  hasTranscript: boolean;
  transcript: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessedVideoSummary {
  videoId: string;
  title: string;
  order: number;
  hasTranscript: boolean;
  hasNotes: boolean;
  updatedAt: Date;
}

export interface PersistedUser {
  _id?: ObjectId;
  uid: string;
  email: string;
  displayName: string;
  summariesCount: number;
  playlistCount: number;
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersistedSummary {
  _id?: ObjectId;
  uid: string;
  url: string;
  title: string;
  type: "video" | "playlist";
  summary: string;
  keyPoints: string[];
  keywords: string[];
  videoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

let clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(
      new Error("MONGODB_URI is not configured. Mongo persistence is disabled.")
    );
  }

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    // Small API app: fail quickly if DB is unreachable instead of hanging requests.
    serverSelectionTimeoutMS: 5000,
  });

  clientPromise = client.connect();
  return clientPromise;
}

function getDbNameFromUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    const dbName = parsed.pathname.replace(/^\//, "");
    return dbName || "yt_study_assistant";
  } catch {
    return "yt_study_assistant";
  }
}

async function getCollection() {
  const client = await getClient();
  const dbName = getDbNameFromUri(process.env.MONGODB_URI || "");
  return client.db(dbName).collection<PersistedJobData>("jobs");
}

async function getProcessedVideosCollection() {
  const client = await getClient();
  const dbName = getDbNameFromUri(process.env.MONGODB_URI || "");
  return client
    .db(dbName)
    .collection<PersistedProcessedVideo>("processed_videos");
}

async function getUsersCollection() {
  const client = await getClient();
  const dbName = getDbNameFromUri(process.env.MONGODB_URI || "");
  return client.db(dbName).collection<PersistedUser>("users");
}

async function getSummariesCollection() {
  const client = await getClient();
  const dbName = getDbNameFromUri(process.env.MONGODB_URI || "");
  return client.db(dbName).collection<PersistedSummary>("summaries");
}

export async function initializeMongoPersistence(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.warn("⚠ Mongo persistence disabled: MONGODB_URI not set.");
    return;
  }

  const collection = await getCollection();
  const processedCollection = await getProcessedVideosCollection();
  const usersCollection = await getUsersCollection();
  const summariesCollection = await getSummariesCollection();

  // Jobs indices
  await collection.createIndex({ jobId: 1 }, { unique: true });
  await collection.createIndex({ "source.type": 1, "source.url": 1 });
  await collection.createIndex({ updatedAt: -1 });

  // Processed videos indices
  await processedCollection.createIndex({ jobId: 1, order: 1 });
  await processedCollection.createIndex({ jobId: 1, videoId: 1 }, { unique: true });

  // Users indices
  await usersCollection.createIndex({ uid: 1 }, { unique: true });
  await usersCollection.createIndex({ email: 1 });
  await usersCollection.createIndex({ createdAt: -1 });

  // Summaries indices
  await summariesCollection.createIndex({ uid: 1, createdAt: -1 });
  await summariesCollection.createIndex({ uid: 1, url: 1 });

  console.log("✅ Mongo persistence connected");
}

export async function persistJob(
  jobId: string,
  job: Omit<PersistedJobData, "jobId" | "updatedAt">
): Promise<void> {
  const collection = await getCollection();
  await collection.updateOne(
    { jobId },
    {
      $set: {
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        source: job.source,
        playlistVideos: job.playlistVideos,
        updatedAt: new Date(),
      },
      $setOnInsert: { jobId },
    },
    { upsert: true }
  );
}

export async function getPersistedJob(jobId: string): Promise<PersistedJobData | null> {
  const collection = await getCollection();
  return collection.findOne({ jobId });
}

export async function findPersistedJobBySource(
  sourceType: "playlist" | "video",
  sourceUrl: string
): Promise<PersistedJobData | null> {
  const collection = await getCollection();
  return collection.findOne({
    "source.type": sourceType,
    "source.url": sourceUrl,
    status: { $ne: "completed" },
  });
}

export async function listPersistedJobs(limit = 20): Promise<PersistedJobSummary[]> {
  const collection = await getCollection();
  const rows = await collection
    .find(
      {},
      {
        projection: {
          jobId: 1,
          status: 1,
          "result.playlistTitle": 1,
          "result.videoCount": 1,
          updatedAt: 1,
          "progress.currentVideo": 1,
        },
      }
    )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((row) => ({
    jobId: row.jobId,
    status: row.status,
    title:
      row.result?.playlistTitle ||
      row.progress.currentVideo ||
      "Untitled processing job",
    videoCount: row.result?.videoCount || 0,
    updatedAt: row.updatedAt,
  }));
}

export async function persistProcessedVideo(
  jobId: string,
  payload: {
    videoId: string;
    title: string;
    order: number;
    hasTranscript: boolean;
    transcript?: string;
    notes?: string;
  }
): Promise<void> {
  const collection = await getProcessedVideosCollection();
  await collection.updateOne(
    { jobId, videoId: payload.videoId },
    {
      $set: {
        title: payload.title,
        order: payload.order,
        hasTranscript: payload.hasTranscript,
        transcript: payload.transcript || null,
        notes: payload.notes || null,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        jobId,
        videoId: payload.videoId,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function listProcessedVideoSummaries(
  jobId: string
): Promise<ProcessedVideoSummary[]> {
  const collection = await getProcessedVideosCollection();
  const rows = await collection
    .find(
      { jobId },
      {
        projection: {
          videoId: 1,
          title: 1,
          order: 1,
          hasTranscript: 1,
          notes: 1,
          updatedAt: 1,
        },
      }
    )
    .sort({ order: 1 })
    .toArray();

  return rows.map((row) => ({
    videoId: row.videoId,
    title: row.title,
    order: row.order,
    hasTranscript: row.hasTranscript,
    hasNotes: !!(row.notes && row.notes.trim().length > 0),
    updatedAt: row.updatedAt,
  }));
}

export async function getProcessedVideoContent(
  jobId: string,
  videoId: string
): Promise<PersistedProcessedVideo | null> {
  const collection = await getProcessedVideosCollection();
  return collection.findOne({ jobId, videoId });
}

export async function listProcessedVideoContents(
  jobId: string
): Promise<PersistedProcessedVideo[]> {
  const collection = await getProcessedVideosCollection();
  return collection.find({ jobId }).sort({ order: 1 }).toArray();
}

// ── User Management ────────────────────────────────────────

export async function syncOrCreateUser(userData: {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
}): Promise<void> {
  const collection = await getUsersCollection();
  await collection.updateOne(
    { uid: userData.uid },
    {
      $set: {
        email: userData.email,
        displayName: userData.displayName,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        uid: userData.uid,
        summariesCount: 0,
        playlistCount: 0,
        videoCount: 0,
        createdAt: userData.createdAt,
      },
    },
    { upsert: true }
  );
}

export async function getUserProfile(uid: string): Promise<PersistedUser | null> {
  const collection = await getUsersCollection();
  return collection.findOne({ uid });
}

// ── Summary Management ─────────────────────────────────────

export async function saveSummary(
  uid: string,
  summaryData: {
    url: string;
    title: string;
    type: "video" | "playlist";
    summary: string;
    keyPoints: string[];
    keywords: string[];
    videoCount: number;
    createdAt: Date;
  }
): Promise<string> {
  const collection = await getSummariesCollection();
  const result = await collection.insertOne({
    uid,
    url: summaryData.url,
    title: summaryData.title,
    type: summaryData.type,
    summary: summaryData.summary,
    keyPoints: summaryData.keyPoints,
    keywords: summaryData.keywords,
    videoCount: summaryData.videoCount,
    createdAt: summaryData.createdAt,
    updatedAt: new Date(),
  });

  // Update user counts
  const userCollection = await getUsersCollection();
  const updateField =
    summaryData.type === "playlist" ? "playlistCount" : "videoCount";
  await userCollection.updateOne(
    { uid },
    {
      $inc: {
        summariesCount: 1,
        [updateField]: 1,
      },
    }
  );

  return result.insertedId.toString();
}

export async function getUserSummaries(
  uid: string,
  limit = 20
): Promise<PersistedSummary[]> {
  const collection = await getSummariesCollection();
  return collection
    .find({ uid })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function deleteSummary(uid: string, summaryId: string): Promise<boolean> {
  const collection = await getSummariesCollection();
  const { ObjectId } = await import("mongodb");

  let objectId;
  try {
    objectId = new ObjectId(summaryId);
  } catch {
    return false;
  }

  const summary = await collection.findOne({ _id: objectId, uid });
  if (!summary) {
    return false;
  }

  await collection.deleteOne({ _id: objectId });

  // Update user counts
  const userCollection = await getUsersCollection();
  const updateField =
    summary.type === "playlist" ? "playlistCount" : "videoCount";
  await userCollection.updateOne(
    { uid },
    {
      $inc: {
        summariesCount: -1,
        [updateField]: -1,
      },
    }
  );

  return true;
}
