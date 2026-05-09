declare module "yt-dlp-exec" {
  type YtDlpFlags = Record<string, boolean | number | string | undefined>;

  interface PlaylistEntry {
    id?: string;
    title?: string;
    webpage_url?: string;
  }

  interface PlaylistData {
    title?: string;
    entries?: PlaylistEntry[];
  }

  interface YtDlpExec {
    (url: string, flags?: YtDlpFlags): Promise<string | PlaylistData>;
    exec(url: string, flags?: YtDlpFlags, opts?: unknown): Promise<unknown>;
    create(binaryPath: string): YtDlpExec;
    args(url: string, flags?: YtDlpFlags): string[];
    isJSON(value?: string): boolean;
  }

  const ytDlpExec: YtDlpExec;
  export default ytDlpExec;
}
