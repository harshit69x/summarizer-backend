declare module "youtube-transcript/dist/youtube-transcript.esm.js" {
  export interface TranscriptConfig {
    lang?: string;
    fetch?: typeof globalThis.fetch;
  }

  export interface TranscriptResponse {
    text: string;
    duration: number;
    offset: number;
    lang?: string;
  }

  export class YoutubeTranscript {
    static fetchTranscript(
      videoId: string,
      config?: TranscriptConfig
    ): Promise<TranscriptResponse[]>;
  }
}
