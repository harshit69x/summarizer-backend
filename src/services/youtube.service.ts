import ytDlpExec from "yt-dlp-exec";
import ytpl from "ytpl";

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
}

interface PlaylistEntry {
  id?: string;
  title?: string;
  webpage_url?: string;
}

function extractVideoId(videoUrl: string): string | null {
  const trimmed = videoUrl.trim();
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function normalizePlaylistUrl(playlistUrl: string): string {
  try {
    const url = new URL(playlistUrl);
    const listId = url.searchParams.get("list");
    if (!listId) {
      return playlistUrl;
    }

    return `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
  } catch {
    return playlistUrl;
  }
}

export async function getPlaylistVideos(
  playlistUrl: string
): Promise<{ title: string; videos: VideoInfo[] }> {
  try {
    const normalizedUrl = normalizePlaylistUrl(playlistUrl);
    console.log(`📚 Playlist extraction started: ${playlistUrl}`);
    if (normalizedUrl !== playlistUrl) {
      console.log(`📚 Normalized playlist URL: ${normalizedUrl}`);
    }
    try {
      console.log("📚 Trying yt-dlp JSON enumeration for playlist entries...");
      const playlistData = (await ytDlpExec(normalizedUrl, {
        dumpSingleJson: true,
        flatPlaylist: true,
        noWarnings: true,
        playlistReverse: false,
      })) as {
        title?: string;
        entries?: PlaylistEntry[];
      };

      const videos: VideoInfo[] = (playlistData.entries || [])
        .filter((entry) => typeof entry.id === "string" && entry.id.length === 11)
        .map((entry) => {
          const id = entry.id as string;
          const title = entry.title?.trim() || `Video ${id}`;
          return {
            id,
            title,
            url: entry.webpage_url || `https://www.youtube.com/watch?v=${id}`,
          };
        });

      if (videos.length > 0) {
        console.log(
          `📚 yt-dlp playlist enumeration succeeded: ${videos.length} videos extracted`
        );
        return {
          title: playlistData.title?.trim() || "YouTube Playlist",
          videos,
        };
      }

      console.warn("⚠ yt-dlp returned no usable playlist entries; falling back to ytpl.");
    } catch (error) {
      // Fall back to ytpl when yt-dlp JSON extraction is unavailable.
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`⚠ yt-dlp playlist enumeration failed; falling back to ytpl. Reason: ${reason}`);
    }

    console.log("📚 Trying ytpl fallback for playlist entries...");
    const playlist = await ytpl(normalizedUrl, { limit: Infinity });
    const videos: VideoInfo[] = playlist.items.map((item) => ({
      id: item.id,
      title: item.title,
      url: item.shortUrl || `https://www.youtube.com/watch?v=${item.id}`,
    }));
    console.log(`📚 ytpl fallback succeeded: ${videos.length} videos extracted`);
    return { title: playlist.title, videos };
  } catch (error) {
    throw new Error(
      `Failed to fetch playlist: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getSingleVideoInfo(
  videoUrl: string
): Promise<{ title: string; videos: VideoInfo[] }> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube video URL.");
  }

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = `Video ${videoId}`;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = (await res.json()) as { title?: string };
      if (typeof data.title === "string" && data.title.trim()) {
        title = data.title.trim();
      }
    }
  } catch {
    // Title lookup is best-effort; transcript flow can still proceed with the video id.
  }

  return {
    title,
    videos: [{ id: videoId, title, url: canonicalUrl }],
  };
}
