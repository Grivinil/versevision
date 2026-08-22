# VerseVision alignment backend

VerseVision exposes one alignment response contract and supports two implementations:

- `meter_estimate` (default): deterministic line/word timing distributed from lyric text, detected sections, and beat spacing;
- `acoustic_forced` (optional): an injected worker adapter that aligns supplied lyrics against decoded audio.

The acoustic adapter receives:

```js
{
  lyrics,
  lyricsSource,
  sections,
  beatGrid,
  durationSeconds,
  audioPcm, // decoded samples when available
  audioBytes // original bounded audio payload for a worker
}
```

It must return the same shape as `alignLyrics`, with line and word `startSeconds`, `endSeconds`, `confidence`, and `source` fields. The host can pass it to `alignLyricsWithBackend(input, { acousticAligner })` without changing the API response schema.

The current local runtime does not bundle a Python/torch forced-alignment stack. Until one is supplied, responses remain explicitly marked `mode: "meter_estimate"` and include `alignment_provisional`.

The optional `worker/` service is a private FastAPI adapter around WhisperX. It transcribes the audio, applies wav2vec2 alignment, and maps the aligned words back to the supplied lyric lines. Configure the Node service with `VERSEVISION_ALIGNMENT_WORKER_URL` and a masked `VERSEVISION_ALIGNMENT_WORKER_TOKEN`; leave the URL unset to keep local fallback behavior.
