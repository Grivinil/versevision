import difflib
import json
import os
import re
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile, Form

app = FastAPI(title="VerseVision WhisperX alignment worker", version="0.1.0")
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_LYRICS_CHARS = 20_000


def auth_or_reject(authorization: str | None):
    expected = os.getenv("WORKER_TOKEN", "")
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="invalid worker token")


def normalize_token(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def label_for(value: str) -> str:
    label = re.sub(r"\s+", "-", value.lower())
    if label.startswith("intro"):
        return "intro"
    if label.startswith("chorus") or label.startswith("hook") or label.startswith("refrain"):
        return "chorus"
    if label.startswith("bridge"):
        return "bridge"
    if label.startswith("outro"):
        return "outro"
    if label.startswith("pre-chorus"):
        return "pre-chorus"
    return "verse"


def parse_lyrics(lyrics: str):
    blocks = []
    current = {"label": "verse", "lines": []}
    for raw in lyrics.splitlines():
        line = raw.strip()
        tag = re.fullmatch(r"\[([^\]]+)\]", line)
        if tag:
            if current["lines"]:
                blocks.append(current)
            current = {"label": label_for(tag.group(1)), "lines": []}
        elif line:
            current["lines"].append(line)
        elif current["lines"]:
            blocks.append(current)
            current = {"label": current["label"], "lines": []}
    if current["lines"]:
        blocks.append(current)
    return blocks


def map_blocks(blocks, sections, duration):
    if not sections:
        sections = [{"id": "full_track_01", "label": "full", "startSeconds": 0, "endSeconds": duration}]
    used = set()
    mapped = []
    for index, block in enumerate(blocks):
        expected = 0 if len(blocks) == 1 else round(index * (len(sections) - 1) / (len(blocks) - 1))
        target = min(len(sections) - 1, expected)
        if target in used:
            available = [candidate for candidate in range(len(sections)) if candidate not in used]
            if available:
                target = min(available, key=lambda candidate: abs(candidate - expected))
        used.add(target)
        mapped.append((block, sections[target]))
    return mapped


def syllable_weight(word: str) -> int:
    letters = re.sub(r"[^a-z]", "", word.lower())
    return max(1, len(re.findall(r"[aeiouy]+", letters)))


class WhisperXEngine:
    def __init__(self):
        self.model = None
        self.align_models = {}

    def load(self):
        if self.model is not None:
            return
        import whisperx

        self.whisperx = whisperx
        device = os.getenv("WHISPERX_DEVICE", "cpu")
        compute_type = os.getenv("WHISPERX_COMPUTE_TYPE", "int8" if device == "cpu" else "float16")
        model_name = os.getenv("WHISPERX_MODEL", "small")
        vad_method = os.getenv("WHISPERX_VAD_METHOD", "silero")
        self.model = whisperx.load_model(model_name, device, compute_type=compute_type, vad_method=vad_method)
        self.device = device

    def transcribe_and_align(self, path: str):
        self.load()
        audio = self.whisperx.load_audio(path)
        result = self.model.transcribe(audio, batch_size=int(os.getenv("WHISPERX_BATCH_SIZE", "4")))
        language = result.get("language", "en")
        if language not in self.align_models:
            self.align_models[language] = self.whisperx.load_align_model(language_code=language, device=self.device)
        model_a, metadata = self.align_models[language]
        aligned = self.whisperx.align(result.get("segments", []), model_a, metadata, audio, self.device, return_char_alignments=False)
        words = []
        for segment in aligned.get("segments", []):
            for item in segment.get("words", []):
                if item.get("start") is None or item.get("end") is None:
                    continue
                text = str(item.get("word", "")).strip()
                if text:
                    words.append({"text": text, "start": float(item["start"]), "end": float(item["end"])})
        duration = len(audio) / 16_000
        return words, duration, language


ENGINE = WhisperXEngine()


@app.on_event("startup")
def preload_model():
    # Fail deployment readiness rather than accepting a first job while the
    # model is still downloading/loading. This prevents caller timeouts on the
    # first request after a worker restart.
    if os.getenv("WHISPERX_PRELOAD", "0") == "1":
        ENGINE.load()


def build_alignment(lyrics: str, context: dict, asr_words: list[dict], duration: float, language: str):
    blocks = parse_lyrics(lyrics)
    if not blocks:
        return {
            "mode": "transcription",
            "source": "whisper_transcription",
            "backend": "whisperx",
            "language": language,
            "durationSeconds": round(duration, 3),
            "text": " ".join(item["text"] for item in asr_words),
            "words": [{"text": item["text"], "startSeconds": round(float(item["start"]), 3), "endSeconds": round(float(item["end"]), 3), "source": "whisperx"} for item in asr_words],
            "wordCount": len(asr_words),
            "confidence": None,
            "warnings": [{"code": "transcription_unscored", "message": "No supplied lyrics were provided for word-error comparison."}]
        }
    sections = context.get("sections") or []
    mapped_blocks = map_blocks(blocks, sections, duration)
    lyric_tokens = []
    for block_index, block in enumerate(blocks):
        for line_index, line in enumerate(block["lines"]):
            for word_index, word in enumerate(line.split()):
                lyric_tokens.append({"token": normalize_token(word), "block": block_index, "line": line_index, "word": word_index, "text": word})
    for index, item in enumerate(lyric_tokens):
        item["index"] = index
    asr_tokens = [normalize_token(item["text"]) for item in asr_words]
    matches = {}
    matcher = difflib.SequenceMatcher(a=[item["token"] for item in lyric_tokens], b=asr_tokens, autojunk=False)
    for tag, left, left_end, right, right_end in matcher.get_opcodes():
        if tag != "equal":
            continue
        for lyric_index, asr_index in zip(range(left, left_end), range(right, right_end)):
            matches[lyric_index] = asr_words[asr_index]

    sections_out = []
    lyric_cursor = 0
    matched_count = 0
    for block_index, (block, audio_section) in enumerate(mapped_blocks):
        start = float(audio_section.get("startSeconds", 0))
        end = float(audio_section.get("endSeconds", duration))
        block_words = [item for item in lyric_tokens if item["block"] == block_index]
        total_weight = max(1, sum(syllable_weight(item["text"]) for item in block_words))
        lines_out = []
        block_line_cursor = start
        for line_index, text in enumerate(block["lines"]):
            line_words = [item for item in block_words if item["line"] == line_index]
            line_weight = max(1, sum(syllable_weight(item["text"]) for item in line_words))
            raw_start = block_line_cursor
            raw_end = min(end, raw_start + (end - start) * line_weight / total_weight * max(1, len(block["lines"])))
            line_matches = []
            for item in line_words:
                lyric_index = item["index"]
                if lyric_index in matches:
                    line_matches.append((item, matches[lyric_index]))
                    matched_count += 1
            if line_matches:
                raw_start = max(start, min(match[1]["start"] for match in line_matches))
                raw_end = min(end, max(match[1]["end"] for match in line_matches))
            if raw_end <= raw_start:
                raw_end = min(end, raw_start + 0.05)
            word_items = []
            line_total = max(1, sum(syllable_weight(item["text"]) for item in line_words))
            word_cursor = raw_start
            for position, item in enumerate(line_words):
                lyric_index = item["index"]
                matched = matches.get(lyric_index)
                if matched:
                    word_start, word_end, confidence, source = matched["start"], matched["end"], 0.9, "acoustic_forced_alignment"
                else:
                    weight = syllable_weight(item["text"])
                    word_end = raw_end if position == len(line_words) - 1 else word_cursor + (raw_end - raw_start) * weight / line_total
                    word_start, confidence, source = word_cursor, 0.28, "provisional_fallback"
                word_start = max(raw_start, min(raw_end, word_start))
                word_end = max(word_start + 0.01, min(raw_end, word_end))
                word_items.append({"text": item["text"], "startSeconds": round(word_start, 3), "endSeconds": round(word_end, 3), "confidence": confidence, "source": source})
                word_cursor = word_end
            line_confidence = 0.9 if len(line_matches) == len(line_words) and line_words else 0.45 if line_matches else 0.28
            lines_out.append({"text": text, "startSeconds": round(raw_start, 3), "endSeconds": round(raw_end, 3), "confidence": line_confidence, "source": "acoustic_forced_alignment" if line_matches else "provisional_fallback", "words": word_items})
            block_line_cursor = raw_end
            lyric_cursor += len(line_words)
        section_confidence = sum(line["confidence"] for line in lines_out) / max(1, len(lines_out))
        sections_out.append({"audioSectionId": audio_section.get("id", f"section_{block_index + 1:02d}"), "label": block["label"], "startSeconds": start, "endSeconds": end, "confidence": round(section_confidence, 3), "lines": lines_out})

    warnings = []
    if matched_count < len(lyric_tokens):
        warnings.append({"code": "alignment_partial", "message": "Some supplied lyric tokens were not present in the ASR transcript and use a bounded fallback window."})
    return {
        "mode": "acoustic_forced",
        "source": "acoustic_forced_alignment",
        "backend": "acoustic_forced",
        "language": language,
        "confidence": round(matched_count / max(1, len(lyric_tokens)), 3),
        "sections": sections_out,
        "lineCount": sum(len(section["lines"]) for section in sections_out),
        "wordCount": sum(len(line["words"]) for section in sections_out for line in section["lines"]),
        "warnings": warnings
    }


@app.get("/health")
def health():
    loaded = ENGINE.model is not None
    if os.getenv("WHISPERX_REQUIRE_READY", "0") == "1" and not loaded:
        raise HTTPException(status_code=503, detail="WhisperX model is still loading")
    return {"service": "versevision-whisperx-worker", "status": "ok", "loaded": loaded, "ready": loaded}


@app.post("/align")
async def align(audio: UploadFile = File(...), lyrics: str = Form(...), context: str = Form("{}"), authorization: str | None = Header(default=None)):
    auth_or_reject(authorization)
    if len(lyrics) > MAX_LYRICS_CHARS:
        raise HTTPException(status_code=413, detail="lyrics exceed size limit")
    try:
        parsed_context = json.loads(context)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail=f"invalid context JSON: {error}") from error
    data = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio exceeds size limit")
    if not data:
        raise HTTPException(status_code=400, detail="audio is empty")
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=Path(audio.filename or "track.mp3").suffix or ".mp3", delete=False) as handle:
            handle.write(data)
            temp_path = handle.name
        asr_words, duration, language = ENGINE.transcribe_and_align(temp_path)
        return build_alignment(lyrics, parsed_context, asr_words, duration, language)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"WhisperX alignment failed: {error}") from error
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass
