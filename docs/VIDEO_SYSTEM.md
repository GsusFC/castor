# Video Publishing System in Castor

## TL;DR for Farcaster Team

**Do we use Neynar?** Yes, but **only for publishing the cast** to Farcaster, not for uploading videos.

### Video Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VIDEO UPLOAD FLOW                           │
│                                                                 │
│   User uploads video                                            │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │ Cloudflare      │  ← TUS protocol (resumable uploads)      │
│   │ Stream          │  ← Processes video, generates HLS/MP4    │
│   └─────────────────┘                                          │
│         │                                                       │
│         │  (alternative: Livepeer)                             │
│         ▼                                                       │
│   Video ready with HLS URL (.m3u8)                             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     CAST PUBLISHING FLOW                        │
│                                                                 │
│   Video status = 'ready'                                        │
│         │                                                       │
│         ▼                                                       │
│   ┌─────────────────┐                                          │
│   │ Neynar SDK      │  ← Only used here, for publishing        │
│   │ publishCast()   │  ← Video URL included as embed           │
│   └─────────────────┘                                          │
│         │                                                       │
│         ▼                                                       │
│   Cast live on Farcaster with embedded video                   │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

1. **Video Upload → Cloudflare Stream (or Livepeer)**
   - Videos are uploaded directly to Cloudflare Stream using TUS protocol
   - Livepeer is supported as an alternative (decentralized infrastructure)
   - Cloudflare processes the video and generates HLS/MP4 URLs
   - We store the `cloudflareId` and `videoStatus` in our database

2. **Cast Publishing → Neynar**
   - When video is ready (`videoStatus: 'ready'`), our publisher uses Neynar SDK
   - The video is included as an **embed** with the HLS or MP4 URL
   - Warpcast renders HLS natively, so users see the video inline

### Code Example

```typescript
// Publisher checks video status before publishing
if (video.videoStatus !== 'ready') {
  // Skip, will retry on next cron run
  continue
}

// Publish via Neynar with video as embed
await neynar.publishCast(signerUuid, content, {
  embeds: [
    { url: video.hlsUrl || video.mp4Url }  // HLS preferred
  ]
})
```

---

## Executive Summary

Castor supports **two video providers** to maximize compatibility with Warpcast:

1. **Cloudflare Stream** (primary) - Direct upload with TUS protocol
2. **Livepeer** (alternative) - Decentralized video infrastructure

Both produce **HLS URLs** that Warpcast renders natively.

---

## Upload Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  /api/media/     │────▶│  Cloudflare     │
│  (Browser)  │     │  upload-url      │     │  Stream         │
└─────────────┘     └──────────────────┘     └─────────────────┘
      │                                              │
      │  TUS Protocol (resumable)                    │
      ▼                                              ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Direct    │────▶│  /api/media/     │────▶│  Video Ready    │
│   Upload    │     │  confirm         │     │  (HLS/MP4)      │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

### Step 1: Request Upload URL

```typescript
// POST /api/media/upload-url
{
  fileName: "video.mp4",
  fileSize: 52428800,  // 50MB
  fileType: "video/mp4"
}

// Response
{
  uploadUrl: "https://upload.cloudflarestream.com/tus/...",
  cloudflareId: "abc123..."
}
```

### Step 2: Upload with TUS Protocol

```typescript
// Resumable upload directly to Cloudflare
fetch(uploadUrl, {
  method: 'POST',
  headers: {
    'Tus-Resumable': '1.0.0',
    'Upload-Length': fileSize,
    'Content-Type': 'application/offset+octet-stream',
  },
  body: videoFile,
})
```

### Step 3: Confirm and Get URLs

```typescript
// POST /api/media/confirm
{ cloudflareId: "abc123...", type: "video" }

// Response
{
  url: "https://customer-xxx.cloudflarestream.com/.../manifest/video.m3u8",
  hlsUrl: "...m3u8",     // For streaming
  mp4Url: "...mp4",      // For download (when ready)
  videoStatus: "pending" // → "ready" when processed
}
```

---

## Database Schema

```sql
CREATE TABLE cast_media (
  id TEXT PRIMARY KEY,
  cast_id TEXT NOT NULL,
  url TEXT NOT NULL,              -- Main URL (HLS preferred)
  type TEXT DEFAULT 'image',      -- 'image' | 'video'
  
  -- Cloudflare Stream
  cloudflare_id TEXT,
  
  -- Livepeer (alternative)
  livepeer_asset_id TEXT,
  livepeer_playback_id TEXT,
  
  -- Processing status
  video_status TEXT,              -- 'pending' | 'processing' | 'ready' | 'error'
  hls_url TEXT,                   -- HLS URL for streaming
  mp4_url TEXT,                   -- MP4 URL when ready
  thumbnail_url TEXT
);
```

---

## Publishing to Farcaster

The **publisher** (`src/lib/publisher.ts`) checks video status before publishing:

```typescript
// 1. Check pending Cloudflare videos
const cloudflareVideos = media.filter(
  m => m.type === 'video' && m.cloudflareId && m.videoStatus !== 'ready'
)

for (const video of cloudflareVideos) {
  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream/${video.cloudflareId}`
  )
  
  if (cfData.result?.readyToStream) {
    // Update DB with HLS URL
    await db.update(castMedia).set({
      videoStatus: 'ready',
      hlsUrl: cfData.result.playback?.hls,
    })
  }
}

// 2. If pending videos exist, SKIP (retry later)
if (pendingVideos.length > 0) {
  continue // Cron will retry
}

// 3. Publish with HLS URL in embeds
const embeds = media.map(m => {
  if (m.type === 'video') {
    // Warpcast prefers HLS over MP4
    return { url: m.hlsUrl || m.mp4Url || m.url }
  }
  return { url: m.url }
})

await publishCast(signerUuid, content, { embeds })
```

---

## URL Priority for Warpcast

```typescript
// Order of preference:
1. HLS (.m3u8)  // Warpcast renders this best
2. MP4          // Fallback
3. Watch URL    // Only for preview
```

---

## Validations

| Constraint | Value |
|------------|-------|
| **Max size** | 100MB for video |
| **Formats** | MP4, MOV, WebM |
| **Max per cast** | 2 media files (image or video) |
| **Rate limiting** | "expensive" operation with strict limits |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/media/upload-url` | POST | Get direct upload URL |
| `/api/media/upload` | POST | Direct upload (alternative) |
| `/api/media/confirm` | POST | Confirm and get final URLs |
| `/api/media/status` | GET | Cloudflare video status |
| `/api/media/livepeer/upload` | POST | Upload to Livepeer (alternative) |
| `/api/media/livepeer/status` | GET | Livepeer asset status |

---

## Why HLS?

Warpcast renders HLS videos natively. The `.m3u8` format enables:

- **Adaptive bitrate streaming** - Adjusts quality based on connection
- **Better mobile experience** - Progressive loading
- **Native player support** - No additional plugins needed

MP4 videos also work but HLS is preferred for best user experience.

---

## Environment Variables

```bash
# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_IMAGES_API_KEY=your_api_key

# Livepeer (optional)
LIVEPEER_API_KEY=your_livepeer_key
```

---

## Video Processing States

```
pending → processing → ready
                    ↘ error
```

- **pending**: Upload received, waiting for processing
- **processing**: Cloudflare/Livepeer is encoding
- **ready**: HLS manifest available, can publish
- **error**: Processing failed

The publisher automatically retries casts with pending videos until they're ready.
