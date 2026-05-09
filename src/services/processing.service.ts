import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getPlaylistVideos, getSingleVideoInfo, type VideoInfo } from "./youtube.service.js";
import { getTranscriptWithRetry } from "./transcript.service.js";
import { generateNotes, generateKeyPoints, generateQuestions } from "./llm.service.js";
import {
  listProcessedVideoContents,
  persistProcessedVideo,
} from "./persistence.service.js";
import {
  getJob,
  updateJobProgress,
  updateJobCheckpoint,
  completeJob,
  failJob,
  type JobResult,
} from "../store.js";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processVideoTranscript(transcript: string): Promise<string> {
  const chunks = await splitter.splitText(transcript);

  // Map phase: generate notes for each chunk
  const chunkNotes: string[] = [];
  for (const chunk of chunks) {
    const notes = await generateNotes(chunk);
    chunkNotes.push(notes);
  }

  // Reduce phase: combine all chunk notes into one
  if (chunkNotes.length === 1) return chunkNotes[0];

  const combined = chunkNotes.join("\n\n---\n\n");
  const finalNotes = await generateNotes(
    `Consolidate and organize the following notes into a single coherent set of study notes. Remove redundancy and ensure logical flow:\n\n${combined}`
  );
  return finalNotes;
}

async function processVideos(
  jobId: string,
  sourceTitle: string,
  videos: VideoInfo[],
  sourceType: "playlist" | "video",
  sourceUrl: string
): Promise<void> {
  const sourceDescriptor = { type: sourceType, url: sourceUrl, title: sourceTitle };
  let processedEntries = await listProcessedVideoContents(jobId);
  if (processedEntries.length === 0) {
    const savedJob = await getJob(jobId);
    const legacyVideos = savedJob?.result?.videos || [];
    if (legacyVideos.length > 0) {
      processedEntries = legacyVideos.map((video, index) => ({
        jobId,
        videoId: video.id,
        title: video.title,
        order: index + 1,
        hasTranscript: video.hasTranscript,
        transcript: video.transcript || null,
        notes: video.notes || null,
        createdAt: savedJob?.createdAt || new Date(),
        updatedAt: new Date(),
      }));
    }
  }
  const processedVideoIds = new Set(processedEntries.map((video) => video.videoId));

  const baseNotes = processedEntries
    .filter((video) => typeof video.notes === "string" && video.notes.trim().length > 0)
    .map((video) => `## ${video.title}\n\n${video.notes}`);
  const baseTranscripts = processedEntries
    .map((video) => video.transcript)
    .filter((transcript): transcript is string => typeof transcript === "string" && transcript.trim().length > 0);
  const videoResults: JobResult["videos"] = processedEntries.map((video) => ({
    id: video.videoId,
    title: video.title,
    hasTranscript: video.hasTranscript,
  }));
  const transcriptFailures: Array<{ title: string; reason: string }> = [];
  const pendingVideos = videos.filter((video) => !processedVideoIds.has(video.id));
  const batchSize = 10;
  const totalBatches = Math.max(1, Math.ceil(videos.length / batchSize));
  let checkpointedCount = processedEntries.length;

  console.log(
    `▶ Processing started for job ${jobId} (${sourceType}) with ${videos.length} extracted video(s)`
  );
  if (processedVideoIds.size > 0) {
    console.log(`↩ Job ${jobId}: resuming with ${processedVideoIds.size} already processed video(s)`);
  }
  updateJobProgress(jobId, {
    total: videos.length,
    phase: "Processing videos...",
    batchSize,
    batchCurrent: processedEntries.length > 0 ? Math.max(1, Math.ceil(processedEntries.length / batchSize)) : 1,
    batchTotal: totalBatches,
    checkpointed: checkpointedCount,
    resumed: processedEntries.length > 0,
  });

  for (let batchStart = 0; batchStart < pendingVideos.length; batchStart += batchSize) {
    const batch = pendingVideos.slice(batchStart, batchStart + batchSize);
    const batchNumber = Math.floor(batchStart / batchSize) + 1;
    console.log(
      `📦 Job ${jobId}: starting batch ${batchNumber}/${totalBatches} with ${batch.length} video(s)`
    );
    updateJobProgress(jobId, {
      batchSize,
      batchCurrent: batchNumber,
      batchTotal: totalBatches,
      checkpointed: checkpointedCount,
      resumed: processedEntries.length > 0,
      phase: `Processing batch ${batchNumber} of ${totalBatches}...`,
    });

    for (let index = 0; index < batch.length; index++) {
      const video = batch[index];
      const processedCount = checkpointedCount + 1;

      console.log(
        `▶ Job ${jobId}: starting video ${processedCount}/${videos.length} - ${video.title} (${video.id})`
      );
      updateJobProgress(jobId, {
        current: processedCount,
        currentVideo: video.title,
        phase: `Fetching transcript for: ${video.title}`,
      });

      let transcript: string | null = null;
      try {
        transcript = await getTranscriptWithRetry(video.url || video.id);
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Unknown transcript error";
        transcriptFailures.push({ title: video.title, reason });
        console.warn(`⚠ No transcript for: ${video.title} (${reason})`);
      }

      if (!transcript) {
        await persistProcessedVideo(jobId, {
          videoId: video.id,
          title: video.title,
          order: processedCount,
          hasTranscript: false,
        });

        videoResults.push({
          id: video.id,
          title: video.title,
          hasTranscript: false,
        });

        updateJobCheckpoint(jobId, {
          source: sourceDescriptor,
          playlistVideos: videos,
          result: {
            playlistTitle: sourceTitle,
            videoCount: videos.length,
            notes: baseNotes.join("\n\n---\n\n"),
            keyPoints: "",
            questions: "",
            videos: videoResults,
          },
        });
        checkpointedCount += 1;
        updateJobProgress(jobId, {
          checkpointed: checkpointedCount,
          batchSize,
          batchCurrent: batchNumber,
          batchTotal: totalBatches,
          resumed: processedEntries.length > 0,
        });
        continue;
      }

      console.log(
        `▶ Job ${jobId}: transcript acquired for ${video.title}, starting note generation`
      );

      baseTranscripts.push(transcript);

      updateJobProgress(jobId, {
        phase: `Generating notes for: ${video.title}`,
      });

      const notes = await processVideoTranscript(transcript);
      baseNotes.push(`## ${video.title}\n\n${notes}`);
      console.log(`▶ Job ${jobId}: note generation completed for ${video.title}`);

      videoResults.push({
        id: video.id,
        title: video.title,
        hasTranscript: true,
      });

      await persistProcessedVideo(jobId, {
        videoId: video.id,
        title: video.title,
        order: processedCount,
        hasTranscript: true,
        transcript,
        notes,
      });

      checkpointedCount += 1;

      updateJobCheckpoint(jobId, {
        source: sourceDescriptor,
        playlistVideos: videos,
        result: {
          playlistTitle: sourceTitle,
          videoCount: videos.length,
          notes: baseNotes.join("\n\n---\n\n"),
          keyPoints: "",
          questions: "",
          videos: videoResults,
        },
      });

      updateJobProgress(jobId, {
        checkpointed: checkpointedCount,
        batchSize,
        batchCurrent: batchNumber,
        batchTotal: totalBatches,
        resumed: processedEntries.length > 0,
      });

      // Small pacing delay helps avoid YouTube transcript throttling on large playlists.
      await sleep(250);
    }

    console.log(`📦 Job ${jobId}: batch ${batchNumber}/${totalBatches} completed`);
  }

  if (baseNotes.length === 0) {
    const details = transcriptFailures
      .slice(0, 3)
      .map((failure) => `"${failure.title}": ${failure.reason}`)
      .join("; ");

    throw new Error(
      `No transcripts could be retrieved for any ${sourceType === "video" ? "content" : "video"}.${details ? ` Sample failures: ${details}` : ""}`
    );
  }

  updateJobProgress(jobId, {
    phase: "Generating final study materials...",
    current: videos.length,
    batchSize,
    batchCurrent: totalBatches,
    batchTotal: totalBatches,
    checkpointed: checkpointedCount,
    resumed: processedEntries.length > 0,
  });

  const combinedNotes = baseNotes.join("\n\n---\n\n");
  const combinedTranscripts = baseTranscripts.join("\n\n");

  let keyPoints = "";
  let questions = "";

  try {
    if (combinedTranscripts.trim().length > 0) {
      const transcriptForGeneration = combinedTranscripts.length > 20000 
        ? combinedTranscripts.slice(0, 20000)
        : combinedTranscripts;
      
      console.log(`▶ Job ${jobId}: generating key points and questions from ${transcriptForGeneration.length} chars of transcript`);
      const results = await Promise.all([
        generateKeyPoints(transcriptForGeneration),
        generateQuestions(transcriptForGeneration),
      ]);
      keyPoints = results[0];
      questions = results[1];
    } else {
      console.warn(`⚠ Job ${jobId}: no combined transcripts available for key points/questions generation`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`⚠ Job ${jobId}: key points/questions generation failed: ${message}`);
  }

  const result: JobResult = {
    playlistTitle: sourceTitle,
    videoCount: videos.length,
    notes: combinedNotes,
    keyPoints,
    questions,
    videos: videoResults,
  };

  completeJob(jobId, result);
  console.log(`✅ Job ${jobId} completed successfully`);
}

export async function processPlaylist(
  jobId: string,
  playlistUrl: string
): Promise<void> {
  try {
    updateJobProgress(jobId, { phase: "Fetching playlist info..." });
    console.log(`▶ Job ${jobId}: resolving playlist URL ${playlistUrl}`);

    const savedJob = await getJob(jobId);
    const { title: playlistTitle, videos } =
      savedJob?.playlistVideos.length
        ? { title: savedJob.source?.title || "YouTube Playlist", videos: savedJob.playlistVideos }
        : await getPlaylistVideos(playlistUrl);
    console.log(
      `▶ Job ${jobId}: playlist resolved as "${playlistTitle}" with ${videos.length} video(s)`
    );
    if (videos.length === 0) {
      console.warn(
        `⚠ Job ${jobId}: playlist extraction returned zero videos for URL ${playlistUrl}`
      );
    }
    updateJobCheckpoint(jobId, {
      source: { type: "playlist", url: playlistUrl, title: playlistTitle },
      playlistVideos: videos,
      result: savedJob?.result || null,
    });
    await processVideos(jobId, playlistTitle, videos, "playlist", playlistUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`❌ Job ${jobId} failed:`, message);
    failJob(jobId, message);
  }
}

export async function processSingleVideo(
  jobId: string,
  videoUrl: string
): Promise<void> {
  try {
    updateJobProgress(jobId, { phase: "Fetching video info..." });
    console.log(`▶ Job ${jobId}: resolving single video URL ${videoUrl}`);
    const { title, videos } = await getSingleVideoInfo(videoUrl);
    console.log(`▶ Job ${jobId}: single video resolved as "${title}"`);
    updateJobCheckpoint(jobId, {
      source: { type: "video", url: videoUrl, title },
      playlistVideos: videos,
    });
    await processVideos(jobId, title, videos, "video", videoUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`❌ Job ${jobId} failed:`, message);
    failJob(jobId, message);
  }
}
