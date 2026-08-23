# VerseVision v0.1 API Specification

## Product contract

VerseVision turns music and creative intent into a time-coded, generator-ready visual blueprint.

The v0.1 service returns analysis, scene planning, prompts, and continuity instructions. It does not render finished video.

## Endpoints

### Preview

`POST /v1/blueprint/preview`

Free, bounded analysis. Returns timing and planning metadata but not the complete prompt package.

### Full blueprint

`POST /v1/blueprint`

Paid route. Returns the complete blueprint described below.

The implementation is deliberately disabled by default. It activates only when the host explicitly enables the route and injects an x402 payment verifier; without both, the route returns a non-chargeable readiness error.

Both routes accept the same logical request. JSON requests use `source.kind = "url"`. Browser or CLI uploads use `multipart/form-data` with a JSON `spec` field and an `audio` file field; the `spec` object uses `source.kind = "upload"`.

## Request schema: `versevision/blueprint-request/v1`

```json
{
  "schema": "versevision/blueprint-request/v1",
  "source": {
    "kind": "url",
    "audioUrl": "https://example.com/track.mp3",
    "title": "Optional track title"
  },
  "creative": {
    "brief": "A neon nocturnal city journey that becomes hopeful at the final chorus.",
    "lyrics": "Optional lyrics supplied by the user",
    "lyricsMode": "provided",
    "narrativeMode": "song",
    "genre": ["electronic", "cinematic"],
    "mood": ["restless", "hopeful"],
    "visualStyle": "Anamorphic night photography, rain reflections, saturated cyan and amber.",
    "visualOverrides": {
      "subject": "A woman in a silver raincoat",
      "setting": "A single coastal motel and its parking lot",
      "wardrobe": "Silver raincoat, red boots, black gloves",
      "palette": "Steel blue and sodium orange",
      "spatialRule": "Always move toward the ocean until the bridge",
      "camera": "Locked-off wides with occasional slow dolly-ins",
      "requiredProps": ["red umbrella", "paper map"],
      "avoid": ["crowds", "text overlays"]
    },
    "referenceUrls": [
      "https://example.com/reference-image.jpg"
    ]
  },
  "alignment": {
    "mode": "provisional"
  },
  "output": {
    "durationSeconds": 180,
    "aspectRatio": "16:9",
    "sceneGranularity": "standard",
    "generatorProfile": "generic",
    "includeAlternates": false
  }
}
```

### Request rules

- `schema` is required and must equal `versevision/blueprint-request/v1`.
- `source` is required.
- For JSON requests, `source.kind` must be `url` and `audioUrl` must be HTTPS.
- For uploads, `source.kind` must be `upload`; the binary field is named `audio`.
- Supported audio formats: MP3, WAV, and M4A.
- Maximum audio size: 25 MB.
- Maximum audio duration: 300 seconds.
- `title` is optional and limited to 200 characters.
- `brief` is optional and limited to 4,000 characters.
- `lyrics` is optional and limited to 20,000 characters.
- `lyricsMode` is optional and must be `provided` or `auto_tag`; `auto_tag` requires `lyrics` and returns a reviewable inferred-tag copy.
- `narrativeMode` is optional and defaults to `song`. Supported values are `song`, `spoken_word`, `meditation`, and
  `cinematic_narration`; the mode changes scene-arc language and spoken-word timing guidance without changing the
  audio or payment contract.
- `alignment.mode` is optional and defaults to `provisional`. `acoustic` is accepted only when lyrics are supplied and is intended for the asynchronous alignment-job route.
- `genre` and `mood` accept up to five strings each, with 80 characters per string.
- `visualStyle` is optional and limited to 2,000 characters.
- `visualOverrides` is optional. It lets the caller lock the subject, setting, wardrobe, palette, screen-direction rule,
  camera language, required props, and forbidden elements across every scene. Text fields are bounded; `requiredProps`
  and `avoid` accept up to eight items each.
- `referenceUrls` accepts up to eight HTTPS image URLs.
- `durationSeconds`, when supplied, must be an integer from 1 to 300 and cannot exceed the analyzed track duration.
- `aspectRatio` must be one of `16:9`, `9:16`, `1:1`, or `4:5`.
- `sceneGranularity` must be `coarse`, `standard`, or `dense`; the default is `standard`. It controls ordered shot
  density (approximately 20, 8, or 5 seconds per shot), not the number of musical scene blocks.
- `generatorProfile` is `generic` in v0.1.
- Unknown fields are rejected.
- The caller must have the right to submit the audio, lyrics, and reference materials.

### Lyric alignment note

When lyrics are supplied, `analysis.lyricAlignment` includes provisional line- and word-level timing distributed across detected section windows and the beat grid. Its `mode` is `meter_estimate`; it is not acoustic forced alignment. Line and word items carry confidence/source metadata and include an `alignment_provisional` warning until an acoustic forced-alignment backend is configured.

### Acoustic alignment jobs

`POST /v1/alignment/jobs` accepts the same logical request plus `alignment.mode = "acoustic"` and returns `202 Accepted` with a job ID. `GET /v1/alignment/jobs/{jobId}` exposes the bounded asynchronous result. Normal preview requests do not invoke the remote worker.

Completed jobs also provide direct lyric downloads:

- `GET /v1/alignment/jobs/{jobId}/lyrics.lrc` returns a standard line-timed `.lrc` file.
- `GET /v1/alignment/jobs/{jobId}/lyrics.enhanced.lrc` returns enhanced LRC with word timestamps where available.

The optional `alignment.mode = "transcription"` is a private benchmark mode only. It must be explicitly enabled by the
server and returns a WhisperX transcript without supplied lyrics; it is not advertised as a public catalog route.

## Full response schema: `versevision/blueprint/v1`

```json
{
  "schema": "versevision/blueprint/v1",
  "requestId": "vv_01JXYZ123",
  "status": "complete",
  "createdAt": "2026-08-21T12:00:00.000Z",
  "source": {
    "title": "Optional track title",
    "kind": "url",
    "mimeType": "audio/mpeg",
    "durationSeconds": 180.42,
    "sha256": "source-content-hash"
  },
  "analysis": {
    "bpm": {
      "value": 118.2,
      "confidence": 0.94
    },
    "beatGrid": {
      "intervalSeconds": 0.508,
      "count": 354,
      "confidence": 0.91
    },
    "sections": [
      {
        "id": "intro",
        "label": "intro",
        "startSeconds": 0,
        "endSeconds": 18.4,
        "confidence": 0.83
      }
    ],
    "lyrics": {
      "mode": "provided"
    },
    "lyricAlignment": {
      "mode": "meter_estimate",
      "source": "beat_and_text_distribution",
      "confidence": 0.38,
      "lineCount": 24,
      "wordCount": 87,
      "sections": [
        {
          "audioSectionId": "verse_01",
          "label": "verse",
          "startSeconds": 0,
          "endSeconds": 26.95,
          "lines": [
            {
              "text": "Sun in the sky",
              "startSeconds": 6.461,
              "endSeconds": 12.46,
              "confidence": 0.42,
              "source": "meter_estimate",
              "words": [
                {
                  "text": "Sun",
                  "startSeconds": 6.461,
                  "endSeconds": 7.12,
                  "confidence": 0.34,
                  "source": "meter_estimate"
                }
              ]
            }
          ]
        }
      ],
      "warnings": [
        {
          "code": "alignment_provisional",
          "message": "Line and word timing is estimated from text weight and beat spacing; acoustic forced alignment is not configured."
        }
      ]
    },
    "energyCurve": [
      {
        "timeSeconds": 0,
        "value": 0.32
      }
    ]
  },
  "styleBible": {
    "visualThesis": "A restless night journey that resolves into warm daylight.",
    "palette": ["cyan", "amber", "deep violet"],
    "lighting": "Wet neon practicals at night, soft sunrise backlight at the resolution.",
    "cameraLanguage": "Slow pushes in verses; wider moving shots on choruses.",
    "texture": "Anamorphic bloom, controlled grain, reflective surfaces.",
    "continuityRules": [
      "Keep the lead character's silver jacket and red scarf in every exterior scene."
    ],
    "entities": [
      {
        "id": "character_01",
        "type": "character",
        "description": "Lead performer in a silver jacket and red scarf."
      }
    ],
    "userOverrides": {
      "palette": "Steel blue and sodium orange"
    }
  },
  "continuityAudit": {
    "status": "pass",
    "score": 100,
    "sceneBlockCount": 7,
    "shotCount": 24,
    "checks": [],
    "violations": []
  },
  "scenes": [
    {
      "id": "scene_01",
      "startSeconds": 0,
      "endSeconds": 8.6,
      "sectionId": "intro",
      "beatCues": [0, 2, 4, 6, 8],
      "intent": "Establish the lonely city and the performer before the first vocal entry.",
      "prompt": "Cinematic wide shot of a rain-soaked neon street at night...",
      "negativePrompt": "inconsistent face, extra limbs, unreadable text, logo, watermark",
      "camera": {
        "shot": "wide",
        "angle": "eye-level",
        "movement": "slow push-in"
      },
      "lighting": "Cyan storefront light with amber reflections in the pavement.",
      "narrative": {
        "subject": "A woman in a silver raincoat",
        "setting": "A single coastal motel and its parking lot",
        "anchor": "the red umbrella and paper map",
        "wardrobe": "Silver raincoat, red boots, black gloves",
        "spatialRule": "Always move toward the ocean until the bridge",
        "palette": "Steel blue and sodium orange"
      },
      "provenance": {
        "subject": "user_supplied",
        "setting": "user_supplied",
        "wardrobe": "user_supplied",
        "palette": "user_supplied",
        "lyricMoments": [],
        "lyricReferences": []
      },
      "edit": {
        "cutOnBeat": true,
        "transition": "hard-cut"
      },
      "continuityRefs": ["character_01", "location_city_01"]
    }
  ],
  "sceneBlocks": "Same section-sized objects as scenes; this explicit alias names their story-architecture role.",
  "shots": [
    {
      "id": "shot_01",
      "sceneBlockId": "scene_01",
      "sectionLabel": "intro",
      "startSeconds": 0,
      "endSeconds": 7.8,
      "role": "establish",
      "prompt": "One generator-ready camera setup with continuity, action, and lighting...",
      "camera": { "shot": "wide establishing shot...", "movement": "wide establishing shot..." },
      "lighting": "Cyan storefront light...",
      "negativePrompt": "inconsistent face, extra limbs, unreadable text, logo, watermark"
    }
  ],
  "artifacts": {
    "markdown": "# VerseVision Blueprint\n...",
    "timingCsv": "scene_id,start_seconds,end_seconds,section_id\nscene_01,0,8.6,intro\n"
  },
  "warnings": [],
  "limits": {
    "sceneBlockCount": 7,
    "shotCount": 24,
    "maxSceneBlockCount": 40,
    "maxShotCount": 40,
    "analysisConfidenceFloor": 0.5
  }
}
```

### Response rules

- `status` is `complete` or `partial`.
- `bpm`, section boundaries, and energy values are observations with confidence values, not guarantees.
- Every scene must have non-overlapping `startSeconds` and `endSeconds` within the requested duration.
- Every scene must contain a prompt, negative prompt, edit guidance, and continuity references.
- `scenes`/`sceneBlocks` are section-sized story architecture. `shots` is the ordered, one-camera-setup output intended
  for copy/paste into generators that accept one shot at a time.
- Every scene block and shot must have non-overlapping `startSeconds` and `endSeconds` within the requested duration.
- `artifacts.markdown`, `artifacts.shotMarkdown`, `artifacts.timingCsv`, and `artifacts.shotTimingCsv` are canonical
  convenience exports of the structured response.
- `artifacts.lrc` is a standard line-timed lyric track suitable for lyric-video and karaoke tools.
- `artifacts.enhancedLrc` is an enhanced LRC track with word-level timestamps where acoustic alignment supplies them;
  lines without reliable word timing remain line-timed.
- `artifacts.lrcMetadata` reports the number of line-timed, word-timed, and approximate lines. LRC timestamps are source
  claims or alignment estimates, not a guarantee of vocal onset precision.
- A low-confidence analysis must produce a warning rather than silently presenting guessed timing as certain.
- `continuityAudit` reports profile drift, broken scene-to-scene state handoffs, missing narrative fields, and timing
  overlaps. A passing audit means the generated profile stayed stable; it does not guarantee that an external generator
  will render identity perfectly.
- Provenance labels are `user_supplied`, `lyric_inferred`, `default_proposal`, or `acoustically_aligned`. They describe
  where a detail came from; they are not confidence scores.

## Preview response schema: `versevision/blueprint-preview/v1`

```json
{
  "schema": "versevision/blueprint-preview/v1",
  "requestId": "vv_01JXYZ123",
  "status": "preview",
  "source": {
    "durationSeconds": 180.42,
    "mimeType": "audio/mpeg"
  },
  "analysisSummary": {
    "bpm": {
      "value": 118.2,
      "confidence": 0.94
    },
    "sectionCount": 7,
    "sceneBlockCount": 7,
    "estimatedSceneCount": 7,
    "estimatedShotCount": 24,
    "shotTargetSeconds": 8,
    "estimatedDurationSeconds": 180.42,
    "lyrics": { "mode": "provided" },
    "lyricAlignment": {
      "mode": "meter_estimate",
      "lineCount": 24,
      "wordCount": 87,
      "confidence": 0.38
    }
  },
  "warnings": [],
  "next": {
    "route": "/v1/blueprint",
    "requiresPayment": true
  }
}
```

## Error schema: `versevision/error/v1`

```json
{
  "schema": "versevision/error/v1",
  "requestId": "vv_01JXYZ123",
  "error": {
    "code": "media_too_long",
    "message": "Audio duration exceeds the 300-second v0.1 limit.",
    "field": "source",
    "retryable": false
  }
}
```

Initial error codes are `invalid_request`, `unsupported_media`, `media_too_large`, `media_too_long`, `source_unreachable`, `analysis_failed`, `payment_required`, and `rate_limited`.
