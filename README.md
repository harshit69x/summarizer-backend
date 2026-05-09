# YouTube Summarizer - Backend API Documentation

A comprehensive backend service for processing YouTube playlists and videos, extracting transcripts, and generating AI-powered study materials (notes, key points, and questions).

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Running the Backend](#running-the-backend)
8. [API Routes Documentation](#api-routes-documentation)
9. [Request/Response Examples](#requestresponse-examples)
10. [Data Models & Types](#data-models--types)
11. [Database Schema](#database-schema)
12. [Error Handling](#error-handling)
13. [Features & Services](#features--services)
14. [Deployment](#deployment)

---

## Overview

The YouTube Summarizer backend is a Node.js/Express application that:

- **Extracts video information** from YouTube playlists and individual videos
- **Fetches transcripts** from YouTube captions or local Whisper transcription
- **Generates AI-powered study materials** using OpenAI's GPT-4o-mini model
- **Manages async job processing** with progress tracking and checkpointing
- **Persists results** to MongoDB for long-term storage and retrieval
- **Supports resumable jobs** for interrupted processing

**Tech Stack:**
- Runtime: Node.js with TypeScript
- Framework: Express.js
- Database: MongoDB
- LLM: OpenAI GPT-4o-mini
- Job Queue: Custom in-memory queue with persistence
- Transcription: YouTube captions + optional local Whisper fallback

---

## Features

### Core Capabilities

1. **Playlist Processing**
   - Extracts all videos from YouTube playlists
   - Supports multiple playlist URL formats
   - Normalizes URLs for consistency

2. **Video Processing**
   - Processes individual YouTube videos
   - Full transcript extraction and analysis

3. **Transcript Acquisition**
   - Primary: YouTube auto-generated captions (multiple language support)
   - Fallback: Local Whisper transcription (optional)
   - Language priority configuration

4. **AI Study Material Generation**
   - **Study Notes**: Structured, markdown-formatted educational notes
   - **Key Points**: Bulleted list of important insights
   - **Questions**: 5-10 conceptual and interview-style questions

5. **Job Management**
   - Real-time progress tracking
   - Batch processing with checkpointing
   - Resume capability for interrupted jobs
   - Status monitoring and history

6. **Data Persistence**
   - MongoDB integration for long-term storage
   - Job history and results archival
   - Processed video content storage

---

## Architecture

### Request Flow

```
Client Request
    ↓
Route Handler
    ↓
Controller (Validation & Job Creation)
    ↓
Job Queue (Enqueue for processing)
    ↓
Processing Pipeline:
    1. Playlist/Video Extraction (youtube.service)
    2. Transcript Fetching (transcript.service)
    3. AI Generation (llm.service)
    4. MongoDB Persistence (persistence.service)
    ↓
Return Job ID to Client
    ↓
Client polls /status and /results endpoints
```

### Service Architecture

- **job-queue.ts**: Asynchronous job processing with concurrency control
- **youtube.service.ts**: YouTube playlist/video extraction (yt-dlp + ytpl)
- **transcript.service.ts**: Transcript fetching from YouTube or local Whisper
- **llm.service.ts**: OpenAI API integration for generating study materials
- **persistence.service.ts**: MongoDB operations for storing jobs and results
- **processing.service.ts**: Main pipeline orchestrating all services

---

## Prerequisites

- **Node.js**: v18+ (v22 has issues with youtube-transcript module)
- **npm**: v9+
- **MongoDB**: Atlas or local instance
- **OpenAI API Key**: For GPT-4o-mini model
- **yt-dlp**: Installed system-wide (for playlist extraction)
  - Install: `pip install yt-dlp`
- **Python 3.8+**: For Whisper transcription (optional)

### System Dependencies

#### macOS/Linux

```bash
# Install yt-dlp
pip install yt-dlp

# Optional: For local Whisper transcription
pip install openai-whisper
ffmpeg  # For audio processing
```

#### Windows

```bash
# Install yt-dlp
pip install yt-dlp

# Optional: For local Whisper transcription
pip install openai-whisper
# Download ffmpeg from: https://ffmpeg.org/download.html
```

---

## Installation & Setup

### 1. Clone Repository

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/youtube-summarizer

# Optional (defaults shown)
PORT=3001
NODE_ENV=development
ENABLE_LOCAL_TRANSCRIBE=true
TRANSCRIPT_LANG_PRIORITY=auto,en,en-US,hi,hi-IN
```

### 4. Optional: Set Up Local Whisper Transcription

```bash
npm run setup:whisper
```

### 5. Verify Setup

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
# {"status":"ok","timestamp":"2026-05-09T...Z"}
```

---

## Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `OPENAI_API_KEY` | string | ✅ Yes | - | OpenAI API key for GPT-4o-mini model |
| `MONGODB_URI` | string | ✅ Yes | - | MongoDB connection URI (Atlas or local) |
| `PORT` | number | ❌ No | 3001 | Express server port |
| `NODE_ENV` | string | ❌ No | development | Runtime environment (development/production) |
| `ENABLE_LOCAL_TRANSCRIBE` | boolean | ❌ No | true | Enable local Whisper fallback for transcripts |
| `TRANSCRIPT_LANG_PRIORITY` | string | ❌ No | auto,en,en-US,hi,hi-IN | Comma-separated language codes for transcript attempts |

### Environment Setup Examples

**Development (local MongoDB):**

```env
OPENAI_API_KEY=sk-proj-xxxxx
MONGODB_URI=mongodb://localhost:27017/youtube-summarizer
PORT=3001
ENABLE_LOCAL_TRANSCRIBE=true
```

**Production (MongoDB Atlas):**

```env
OPENAI_API_KEY=sk-proj-xxxxx
MONGODB_URI=mongodb+srv://user:password@cluster0.mongodb.net/youtube-summarizer
PORT=3001
NODE_ENV=production
ENABLE_LOCAL_TRANSCRIBE=false
```

---

## Running the Backend

### Development Mode (with hot reload)

```bash
npm run dev
```

- Watches for file changes and auto-restarts
- Uses `tsx` for TypeScript support
- Runs on `http://localhost:3001`

### Production Mode

```bash
# Build TypeScript to JavaScript
npm run build

# Run compiled code
npm start
```

### Server Output

```
🚀 Backend server running on http://localhost:3001
   LLM Provider: OpenAI
   Local Transcription Fallback: enabled
```

---

## API Routes Documentation

### Base URL

```
http://localhost:3001/api
```

---

### 1. POST `/process-playlist`

Process an entire YouTube playlist and generate study materials for all videos.

#### Request

```http
POST /api/process-playlist
Content-Type: application/json

{
  "url": "https://www.youtube.com/playlist?list=PLxxxxx"
}
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ Yes | Valid YouTube playlist URL |

#### Response

**Status Code:** `201 Created`

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "resumed": false
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | string | Unique job identifier (UUID) for tracking progress |
| `resumed` | boolean | `true` if resuming incomplete job; `false` if new job |

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 400 | "A valid playlist URL is required." | Missing or invalid URL parameter |
| 400 | "URL does not appear to be a YouTube playlist." | URL format invalid (must contain `youtube.com/playlist` or `list=`) |
| 500 | "Failed to start playlist job." | Server error during job creation |

#### Supported Playlist URL Formats

```
✅ https://www.youtube.com/playlist?list=PLxxxxx
✅ https://youtube.com/playlist?list=PLxxxxx&index=1
✅ https://www.youtube.com/playlist?list=PLxxxxx&v=xxxxx
✅ youtube.com/playlist?list=PLxxxxx
```

---

### 2. POST `/process-video`

Process a single YouTube video and generate study materials.

#### Request

```http
POST /api/process-video
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | ✅ Yes | Valid YouTube video URL |

#### Response

**Status Code:** `201 Created`

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "resumed": false
}
```

#### Response Fields

Same as `/process-playlist`

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 400 | "A valid YouTube video URL is required." | Missing or invalid URL parameter |
| 400 | "URL does not appear to be a valid YouTube video." | URL format invalid |
| 500 | "Failed to start video job." | Server error during job creation |

#### Supported Video URL Formats

```
✅ https://www.youtube.com/watch?v=dQw4w9WgXcQ
✅ https://youtu.be/dQw4w9WgXcQ
✅ https://www.youtube.com/shorts/dQw4w9WgXcQ
✅ https://www.youtube.com/embed/dQw4w9WgXcQ
✅ youtube.com/watch?v=dQw4w9WgXcQ&t=10s
```

---

### 3. GET `/status/:jobId`

Get the current processing status and progress of a job.

#### Request

```http
GET /api/status/550e8400-e29b-41d4-a716-446655440000
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | UUID of the job returned from process endpoints |

#### Response

**Status Code:** `200 OK`

```json
{
  "status": "processing",
  "progress": {
    "current": 3,
    "total": 10,
    "currentVideo": "Video Title - dQw4w9WgXcQ",
    "phase": "Processing videos",
    "batchSize": 3,
    "batchCurrent": 1,
    "batchTotal": 4,
    "checkpointed": 0,
    "resumed": false
  },
  "error": null,
  "processedVideos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "order": 1,
      "hasTranscript": true,
      "hasNotes": true,
      "updatedAt": "2026-05-09T10:30:00.000Z"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Job status: `queued`, `processing`, `completed`, or `failed` |
| `progress.current` | number | Videos processed so far |
| `progress.total` | number | Total videos in job |
| `progress.currentVideo` | string | Title and ID of video being processed |
| `progress.phase` | string | Current processing phase (e.g., "Extracting videos", "Processing videos") |
| `progress.batchSize` | number | Size of concurrent processing batch |
| `progress.batchCurrent` | number | Current batch number |
| `progress.batchTotal` | number | Total batches |
| `progress.checkpointed` | number | Checkpoints saved (for resumed jobs) |
| `progress.resumed` | boolean | Whether job was resumed |
| `error` | string \| null | Error message if job failed |
| `processedVideos` | array | Array of ProcessedVideoSummary objects |

#### Job Status Values

- **`queued`**: Job created, waiting in queue
- **`processing`**: Actively processing videos
- **`completed`**: All videos processed successfully
- **`failed`**: Job failed with error (check `error` field)

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 404 | "Job not found." | Invalid or non-existent jobId |

---

### 4. GET `/results/:jobId`

Get the final results and study materials for a completed job.

#### Request

```http
GET /api/results/550e8400-e29b-41d4-a716-446655440000
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | UUID of the job |

#### Response (Completed Job)

**Status Code:** `200 OK`

```json
{
  "playlistTitle": "Complete Python Course 2024",
  "videoCount": 10,
  "notes": "## Module 1: Python Basics\n### Variables and Data Types\n- Explains...",
  "keyPoints": "- Python is a high-level programming language\n- Variables store data values\n- Dynamic typing allows flexibility...",
  "questions": "1. What is the difference between mutable and immutable data types in Python?\n2. How do you declare variables...",
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Python Basics - Variables",
      "hasTranscript": true,
      "transcript": "Today we're going to learn about variables in Python...",
      "notes": "## Variables in Python\n### Definition\nVariables are containers for storing data values..."
    }
  ],
  "videoDetails": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Python Basics - Variables",
      "hasTranscript": true,
      "notes": "## Variables in Python..."
    }
  ]
}
```

#### Response (In-Progress Job with Partial Results)

**Status Code:** `200 OK`

```json
{
  "playlistTitle": "Complete Python Course 2024",
  "videoCount": 3,
  "notes": "## Module 1: Python Basics\n(Partial - based on 3 videos so far)...",
  "keyPoints": "- Python is a high-level programming language\n- Variables store data values...",
  "questions": "1. What is the difference between mutable and immutable data types?\n...",
  "partial": true,
  "videoDetails": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Python Basics - Variables",
      "hasTranscript": true
    }
  ]
}
```

#### Response (Still Processing - No Results Yet)

**Status Code:** `202 Accepted`

```json
{
  "message": "Job is still processing.",
  "status": "processing",
  "progress": {
    "current": 1,
    "total": 10,
    "currentVideo": "Python Basics - Variables - dQw4w9WgXcQ",
    "phase": "Processing videos",
    "batchSize": 3,
    "batchCurrent": 1,
    "batchTotal": 4,
    "checkpointed": 0,
    "resumed": false
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `playlistTitle` | string | Title of the processed playlist or video |
| `videoCount` | number | Total number of videos processed |
| `notes` | string | AI-generated markdown study notes |
| `keyPoints` | string | Bulleted list of key takeaways |
| `questions` | string | Generated questions for self-assessment |
| `videos` | array | Array of individual video results (full results only) |
| `videoDetails` | array | Array of video metadata |
| `partial` | boolean | `true` if results are incomplete (job still processing) |

#### Video Object Structure

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Video Title",
  "hasTranscript": true,
  "transcript": "Full transcript text...",
  "notes": "Video-specific markdown notes..."
}
```

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 404 | "Job not found." | Invalid or non-existent jobId |
| 202 | Job still processing | Status: 202, check `progress` field |

---

### 5. GET `/saved-jobs`

Get list of all saved jobs from MongoDB.

#### Request

```http
GET /api/saved-jobs?limit=20
```

#### Query Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `limit` | number | 20 | 1-100 | Number of jobs to return |

#### Response

**Status Code:** `200 OK`

```json
{
  "jobs": [
    {
      "jobId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "title": "Complete Python Course 2024",
      "videoCount": 10,
      "updatedAt": "2026-05-09T10:30:00.000Z"
    },
    {
      "jobId": "550e8400-e29b-41d4-a716-446655440001",
      "status": "processing",
      "title": "Web Development Masterclass",
      "videoCount": 15,
      "updatedAt": "2026-05-09T09:45:00.000Z"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `jobs` | array | Array of saved job summaries |
| `jobId` | string | Unique job identifier |
| `status` | string | Current job status |
| `title` | string | Playlist/video title |
| `videoCount` | number | Number of videos in job |
| `updatedAt` | string | ISO 8601 timestamp of last update |

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 500 | "Failed to fetch saved jobs." | Database connection or query error |

---

### 6. GET `/processed-videos/:jobId`

Get list of all processed videos for a specific job.

#### Request

```http
GET /api/processed-videos/550e8400-e29b-41d4-a716-446655440000
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | UUID of the job |

#### Response

**Status Code:** `200 OK`

```json
{
  "videos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Python Basics - Variables",
      "order": 1,
      "hasTranscript": true,
      "hasNotes": true,
      "updatedAt": "2026-05-09T10:30:00.000Z"
    },
    {
      "videoId": "xXxXxXxXxXx",
      "title": "Python Functions and Modules",
      "order": 2,
      "hasTranscript": true,
      "hasNotes": true,
      "updatedAt": "2026-05-09T10:35:00.000Z"
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `videos` | array | Array of processed video summaries |
| `videoId` | string | YouTube video ID |
| `title` | string | Video title |
| `order` | number | Video order in playlist (1-indexed) |
| `hasTranscript` | boolean | Whether transcript was successfully extracted |
| `hasNotes` | boolean | Whether study notes were generated |
| `updatedAt` | string | ISO 8601 timestamp |

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 404 | "Job not found." | Invalid jobId |
| 500 | Error message | Database query failed |

---

### 7. GET `/processed-videos/:jobId/:videoId`

Get detailed content (transcript, notes) for a specific video in a job.

#### Request

```http
GET /api/processed-videos/550e8400-e29b-41d4-a716-446655440000/dQw4w9WgXcQ
```

#### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | UUID of the job |
| `videoId` | string | YouTube video ID |

#### Response

**Status Code:** `200 OK`

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Python Basics - Variables",
  "hasTranscript": true,
  "transcript": "Today we're going to learn about variables in Python. A variable is a named container that stores a value...",
  "notes": "## Variables in Python\n\n### Definition\nVariables are containers for storing data values. They have a name and a value.\n\n### Key Characteristics\n- Dynamic typing\n- No declaration needed\n- Can change type at runtime\n\n### Examples\n```python\nname = 'John'\nage = 25\n```"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `videoId` | string | YouTube video ID |
| `title` | string | Video title |
| `hasTranscript` | boolean | Whether transcript exists |
| `transcript` | string | Full video transcript (if available) |
| `notes` | string | Markdown-formatted study notes |

#### Errors

| Status | Error | Reason |
|--------|-------|--------|
| 404 | "Video not found." | Invalid videoId for this job |
| 500 | Error message | Database query failed |

---

### 8. GET `/health`

Health check endpoint to verify server is running.

#### Request

```http
GET /health
```

#### Response

**Status Code:** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-05-09T10:30:00.000Z"
}
```

---

## Request/Response Examples

### Complete Workflow Example

#### Step 1: Submit a Playlist for Processing

```bash
curl -X POST http://localhost:3001/api/process-playlist \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
  }'
```

**Response:**

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "resumed": false
}
```

#### Step 2: Poll for Processing Status

```bash
curl http://localhost:3001/api/status/550e8400-e29b-41d4-a716-446655440000
```

**Response (Processing):**

```json
{
  "status": "processing",
  "progress": {
    "current": 2,
    "total": 5,
    "currentVideo": "Advanced Python Concepts - dQw4w9WgXcQ",
    "phase": "Processing videos",
    "batchSize": 3,
    "batchCurrent": 1,
    "batchTotal": 2,
    "checkpointed": 0,
    "resumed": false
  },
  "error": null,
  "processedVideos": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Python Basics",
      "order": 1,
      "hasTranscript": true,
      "hasNotes": true,
      "updatedAt": "2026-05-09T10:30:00.000Z"
    }
  ]
}
```

#### Step 3: Get Results (when completed)

```bash
curl http://localhost:3001/api/results/550e8400-e29b-41d4-a716-446655440000
```

**Response:**

```json
{
  "playlistTitle": "Python Mastery Course",
  "videoCount": 5,
  "notes": "## Python Mastery Course\n\n### Module 1: Basics\n...",
  "keyPoints": "- Python is a versatile programming language\n- Variables and data types are fundamental...",
  "questions": "1. What are the main data types in Python?\n2. How do decorators work in Python?\n...",
  "videoDetails": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Python Basics",
      "hasTranscript": true,
      "notes": "## Variables and Data Types..."
    }
  ]
}
```

#### Step 4: Get Individual Video Content

```bash
curl http://localhost:3001/api/processed-videos/550e8400-e29b-41d4-a716-446655440000/dQw4w9WgXcQ
```

**Response:**

```json
{
  "videoId": "dQw4w9WgXcQ",
  "title": "Python Basics",
  "hasTranscript": true,
  "transcript": "Hello everyone, today we're going to learn about...",
  "notes": "## Python Basics\n\n### Variables\n..."
}
```

---

## Data Models & Types

### Job Source

```typescript
interface JobSource {
  type: "playlist" | "video";
  url: string;
  title: string;
}
```

### Job Progress

```typescript
interface Progress {
  current: number;              // Videos processed
  total: number;                // Total videos
  currentVideo: string;         // Current video being processed
  phase: string;                // Processing phase name
  batchSize: number;            // Concurrent processing batch size
  batchCurrent: number;         // Current batch number
  batchTotal: number;           // Total batches
  checkpointed: number;         // Checkpoints saved
  resumed: boolean;             // Whether job was resumed
}
```

### Job Result

```typescript
interface JobResult {
  playlistTitle: string;        // Playlist or video title
  videoCount: number;           // Total videos processed
  notes: string;                // Markdown-formatted study notes
  keyPoints: string;            // Bulleted key takeaways
  questions: string;            // Generated self-assessment questions
  videos: JobVideoResult[];     // Individual video results
}
```

### Job Video Result

```typescript
interface JobVideoResult {
  id: string;                   // YouTube video ID
  title: string;                // Video title
  hasTranscript: boolean;       // Transcript exists
  transcript?: string;          // Full transcript text
  notes?: string;               // Video-specific notes
}
```

### Job Data (In-Memory)

```typescript
interface JobData {
  source: JobSource | null;
  playlistVideos: VideoInfo[];
  status: "queued" | "processing" | "completed" | "failed";
  progress: Progress;
  result: JobResult | null;
  error: string | null;
  createdAt: Date;
}
```

### Persisted Job Data (MongoDB)

```typescript
interface PersistedJobData {
  jobId: string;
  source: {
    type: "playlist" | "video";
    url: string;
    title: string;
  } | null;
  playlistVideos: VideoInfo[];
  status: "queued" | "processing" | "completed" | "failed";
  progress: Progress;
  result: JobResult | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Video Info

```typescript
interface VideoInfo {
  id: string;                   // YouTube video ID
  title: string;                // Video title
  url: string;                  // Full video URL
}
```

### Processed Video Summary

```typescript
interface ProcessedVideoSummary {
  videoId: string;
  title: string;
  order: number;                // Position in playlist (1-indexed)
  hasTranscript: boolean;
  hasNotes: boolean;
  updatedAt: Date;
}
```

### Persisted Video

```typescript
interface PersistedProcessedVideo {
  jobId: string;
  videoId: string;
  title: string;
  order: number;
  hasTranscript: boolean;
  transcript: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Database Schema

### MongoDB Collections

#### 1. `jobs` Collection

Stores job metadata and results.

```javascript
{
  _id: ObjectId,                    // MongoDB ID
  jobId: "uuid-string",             // Job UUID
  source: {
    type: "playlist" | "video",
    url: "https://youtube.com/...",
    title: "Playlist Title"
  },
  playlistVideos: [
    {
      id: "dQw4w9WgXcQ",
      title: "Video Title",
      url: "https://youtube.com/watch?v=..."
    }
  ],
  status: "completed",              // queued, processing, completed, failed
  progress: {
    current: 5,
    total: 5,
    currentVideo: "Video Title - dQw4w9WgXcQ",
    phase: "Completed",
    batchSize: 3,
    batchCurrent: 2,
    batchTotal: 2,
    checkpointed: 0,
    resumed: false
  },
  result: {
    playlistTitle: "Python Course",
    videoCount: 5,
    notes: "## Study Notes\n...",
    keyPoints: "- Point 1\n- Point 2\n...",
    questions: "1. Question 1\n2. Question 2\n...",
    videos: [
      {
        id: "dQw4w9WgXcQ",
        title: "Video 1",
        hasTranscript: true,
        transcript: "Transcript text...",
        notes: "Video notes..."
      }
    ]
  },
  error: null,
  createdAt: ISODate("2026-05-09T10:00:00Z"),
  updatedAt: ISODate("2026-05-09T10:35:00Z")
}
```

**Indexes:**

```javascript
// For fast job lookup
db.jobs.createIndex({ jobId: 1 }, { unique: true })

// For finding incomplete jobs by source
db.jobs.createIndex({ "source.type": 1, "source.url": 1, status: 1 })

// For listing recent jobs
db.jobs.createIndex({ updatedAt: -1 })
```

#### 2. `processed_videos` Collection

Stores individual video transcripts and notes.

```javascript
{
  _id: ObjectId,
  jobId: "uuid-string",
  videoId: "dQw4w9WgXcQ",
  title: "Video Title",
  order: 1,
  hasTranscript: true,
  transcript: "Full transcript text...",
  notes: "## Video Notes\n...",
  createdAt: ISODate("2026-05-09T10:10:00Z"),
  updatedAt: ISODate("2026-05-09T10:15:00Z")
}
```

**Indexes:**

```javascript
// For fast video lookup
db.processed_videos.createIndex({ jobId: 1, videoId: 1 }, { unique: true })

// For listing videos in a job
db.processed_videos.createIndex({ jobId: 1, order: 1 })
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful data retrieval (completed job or status) |
| 201 | Created | Job successfully created |
| 202 | Accepted | Job still processing (no results yet) |
| 400 | Bad Request | Invalid URL format, missing parameters |
| 404 | Not Found | Job ID doesn't exist |
| 500 | Server Error | Database error, API failure |

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common Errors

#### Invalid Playlist URL

```json
{
  "error": "URL does not appear to be a YouTube playlist."
}
```

**Fix:** Ensure URL contains `youtube.com/playlist` or `list=` parameter

#### Invalid Video URL

```json
{
  "error": "URL does not appear to be a valid YouTube video."
}
```

**Fix:** Use format: `youtube.com/watch?v=VIDEO_ID` or `youtu.be/VIDEO_ID`

#### Missing API Key

```
Error: OPENAI_API_KEY is required in backend environment configuration.
```

**Fix:** Add `OPENAI_API_KEY` to `.env` file

#### MongoDB Connection Failed

```
Error: Failed to connect to MongoDB
```

**Fix:** Verify `MONGODB_URI` in `.env` and whitelist IP in MongoDB Atlas

#### Job Not Found

```json
{
  "error": "Job not found."
}
```

**Fix:** Verify jobId is correct. Check `/saved-jobs` to list existing jobs.

---

## Features & Services

### 1. YouTube Service (`youtube.service.ts`)

**Purpose:** Extract video information from YouTube playlists and individual videos

**Key Functions:**

- `getPlaylistVideos(url)`: Extracts all videos from a playlist
- `normalizePlaylistUrl(url)`: Normalizes various playlist URL formats
- Dual extraction method (yt-dlp + ytpl fallback)

**Supported Formats:**

- Playlists: `youtube.com/playlist?list=PLxxxxx`
- Videos: `youtube.com/watch?v=dQw4w9WgXcQ`, `youtu.be/dQw4w9WgXcQ`, `youtube.com/shorts/xxxxx`

### 2. Transcript Service (`transcript.service.ts`)

**Purpose:** Fetch video transcripts with multiple fallback strategies

**Strategies:**

1. **YouTube Auto-Captions** (Primary)
   - Attempts languages in priority order
   - Configured via `TRANSCRIPT_LANG_PRIORITY` env variable
   - Default: `auto,en,en-US,hi,hi-IN`

2. **Local Whisper Transcription** (Fallback)
   - Uses OpenAI Whisper for transcription
   - Enabled by `ENABLE_LOCAL_TRANSCRIBE=true`
   - Downloads audio and transcribes locally

**Language Support:**

Configured via environment: `TRANSCRIPT_LANG_PRIORITY=auto,en,en-US,hi,hi-IN`

### 3. LLM Service (`llm.service.ts`)

**Purpose:** Generate AI-powered study materials using OpenAI GPT-4o-mini

**Generated Content:**

1. **Study Notes** (`generateNotes`)
   - Structured markdown format
   - Clear headings and subheadings
   - Educational focus

2. **Key Points** (`generateKeyPoints`)
   - Bulleted list format
   - Important insights extracted
   - Concise and thorough

3. **Questions** (`generateQuestions`)
   - 5-10 conceptual questions
   - Interview-style questions
   - Tests understanding, application, analysis

**LLM Configuration:**

- Model: `gpt-4o-mini`
- Temperature: 0.3 (consistent, less creative)
- Max Tokens: 2000

### 4. Job Queue (`job-queue.ts`)

**Purpose:** Asynchronously process jobs with progress tracking and checkpointing

**Features:**

- Concurrent batch processing (3 videos at a time)
- Real-time progress updates
- Automatic checkpointing for resume capability
- Error handling with retry logic

**Processing Pipeline:**

```
1. Dequeue job
2. Extract playlist/video URLs
3. For each video:
   a. Fetch transcript
   b. Generate study notes
   c. Generate key points
   d. Generate questions
   e. Save to MongoDB
4. Aggregate results
5. Mark job complete
```

### 5. Persistence Service (`persistence.service.ts`)

**Purpose:** Handle all MongoDB operations for job and video persistence

**Key Functions:**

- `persistJob()`: Save or update job data
- `getPersistedJob()`: Retrieve job by ID
- `listPersistedJobs()`: Get recent saved jobs
- `persistProcessedVideo()`: Save individual video results
- `getProcessedVideoContent()`: Retrieve video transcript and notes
- `listProcessedVideoSummaries()`: Get video list for a job

### 6. Processing Service (`processing.service.ts`)

**Purpose:** Main orchestration pipeline

**Workflow:**

1. Validate input URL
2. Extract video list from YouTube
3. Initialize job progress
4. Process videos in batches:
   - Get transcript (YouTube captions → Whisper fallback)
   - Generate study notes, key points, questions
   - Persist to MongoDB
5. Aggregate final results
6. Update job status

---

## Deployment

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start app
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t youtube-summarizer-backend .
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=your_key \
  -e MONGODB_URI=your_uri \
  youtube-summarizer-backend
```

### Render Deployment

1. Push code to GitHub
2. Create new Web Service on Render
3. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/index.js`
   - **Node Version:** 18
4. Add environment variables
5. Deploy

### AWS Deployment

1. Create EC2 instance (t2.medium+)
2. Install Node.js 18+
3. Clone repository
4. Install dependencies: `npm install`
5. Set environment variables in `.env`
6. Build: `npm run build`
7. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start dist/index.js --name "youtube-summarizer"
pm2 save
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** `Module youtube-transcript not found`

**Solution:** Use Node.js v18 (not v22). The package has ESM issues on newer versions.

**Issue:** Vite build fails with tailwindcss error

**Solution:** Install tailwindcss in workspace root or create local postcss config in frontend directory.

**Issue:** MongoDB connection timeout

**Solution:** 
- Check MONGODB_URI is correct
- Whitelist your IP in MongoDB Atlas
- Verify network connectivity

**Issue:** OpenAI API rate limits

**Solution:**
- Upgrade OpenAI plan for higher limits
- Implement request queueing (currently not in place)
- Process fewer videos concurrently

---

## Performance Considerations

### Optimization Tips

1. **Batch Size:** Adjust concurrent video processing in `job-queue.ts`
2. **Timeout Handling:** MongoDB selection timeout is 5 seconds
3. **Transcript Caching:** Future: Cache transcripts to avoid re-fetching
4. **LLM Caching:** Consider caching for identical transcripts

### Scalability

- **Current Architecture:** Single Node.js process, suitable for < 100 concurrent jobs
- **For Higher Load:** Implement Redis queue, use BullMQ/RabbitMQ
- **Database:** MongoDB Atlas auto-scaling recommended

---

## Future Enhancements

- [ ] Add transcript caching
- [ ] Implement Redis for distributed job queue
- [ ] Add support for additional LLM providers
- [ ] Batch API requests for efficiency
- [ ] WebSocket support for real-time progress
- [ ] User authentication and job history per user
- [ ] Export results as PDF/DOCX

---

## License

MIT

---

## Support

For issues and questions, refer to the main project repository.
