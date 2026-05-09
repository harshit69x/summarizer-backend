import argparse
import os
import sys

from faster_whisper import WhisperModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Transcribe an audio file with Faster-Whisper")
    parser.add_argument("--audio", required=True, help="Path to audio file")
    parser.add_argument("--model", default="small", help="Whisper model size")
    parser.add_argument("--language", default=None, help="Language code, e.g. en")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not os.path.isfile(args.audio):
        print(f"Audio file not found: {args.audio}", file=sys.stderr)
        return 1

    device = os.getenv("WHISPER_DEVICE", "auto")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

    try:
        model = WhisperModel(args.model, device=device, compute_type=compute_type)
        segments, _ = model.transcribe(
            args.audio,
            language=args.language,
            vad_filter=True,
        )

        parts = []
        for segment in segments:
            text = segment.text.strip()
            if text:
                parts.append(text)

        transcript = " ".join(parts).strip()
        if not transcript:
            print("Transcription output is empty", file=sys.stderr)
            return 1

        print(transcript)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Transcription failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
