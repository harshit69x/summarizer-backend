import { YoutubeTranscript } from "youtube-transcript/dist/youtube-transcript.esm.js";
import { transcribeVideoWithLocalWhisper } from "./local-transcription.service.js";

function isLocalTranscribeEnabled(): boolean {
  const value = (process.env.ENABLE_LOCAL_TRANSCRIBE ?? "true").trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "no";
}

function getLanguageAttempts(): Array<string | undefined> {
  const raw = (process.env.TRANSCRIPT_LANG_PRIORITY ?? "auto,en,en-US,hi,hi-IN").trim();
  if (!raw) {
    return [undefined, "en", "en-US", "hi", "hi-IN"];
  }

  const parsed = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => {
      const normalized = token.toLowerCase();
      if (normalized === "auto" || normalized === "default") {
        return undefined;
      }
      return token;
    });

  return parsed.length > 0 ? parsed : [undefined, "en", "en-US", "hi", "hi-IN"];
}

function normalizeTranscriptText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function getTranscript(videoId: string): Promise<string> {
  console.log(`📝 Transcript lookup started for: ${videoId}`);
  return getTranscriptOnce(videoId);
}

async function getTranscriptOnce(videoId: string): Promise<string> {
  const languageAttempts = getLanguageAttempts();
  const failureReasons: string[] = [];

  for (const lang of languageAttempts) {
    try {
      console.log(
        `📝 Trying YouTube captions for ${videoId}${lang ? ` (${lang})` : " (default)"}`
      );
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
        ...(lang ? { lang } : {}),
      });

      if (!transcriptItems || transcriptItems.length === 0) {
        failureReasons.push(
          lang ? `${lang}: empty transcript` : "default: empty transcript"
        );
        continue;
      }

      const fullText = normalizeTranscriptText(
        transcriptItems.map((item) => item.text).join(" ")
      );
      if (!fullText.trim()) {
        failureReasons.push(
          lang ? `${lang}: transcript text was blank` : "default: transcript text was blank"
        );
        continue;
      }

      console.log(
        `📝 Captions found for ${videoId}${lang ? ` (${lang})` : " (default language)"}`
      );
      return fullText;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failureReasons.push(lang ? `${lang}: ${reason}` : `default: ${reason}`);
      console.warn(`⚠ Caption lookup failed for ${videoId}${lang ? ` (${lang})` : ""}: ${reason}`);
    }
  }

  if (isLocalTranscribeEnabled()) {
    try {
      console.log(`🎧 Falling back to local audio transcription for ${videoId}`);
      const localTranscript = await transcribeVideoWithLocalWhisper(videoId);
      if (localTranscript.trim()) {
        console.log(`🎧 Local transcription succeeded for ${videoId}`);
        return localTranscript;
      }
      failureReasons.push("local: transcription output was blank");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failureReasons.push(`local: ${reason}`);
      console.warn(`⚠ Local transcription failed for ${videoId}: ${reason}`);
    }
  }

  throw new Error(
    `Transcript unavailable for video ${videoId}. Attempts: ${failureReasons.join(" | ")}`
  );
}

export async function getTranscriptWithRetry(
  videoId: string,
  attempts = 3
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getTranscriptOnce(videoId);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        const waitMs = 750 * attempt;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(String(lastError || "Transcript retrieval failed."));
}
