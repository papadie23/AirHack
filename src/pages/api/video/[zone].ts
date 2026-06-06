/**
 * /api/video/[zone] — streams MP4 files from video_analytics/ with range support.
 * Used as a fallback when the Python MJPEG stream server (port 5001) is offline.
 * Zones: gate1 → gate.mp4 | gate2 → checkin.mp4 | disembark → disembark.mp4
 */
import type { APIRoute } from "astro";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { join } from "node:path";

export const prerender = false;

const VIDEO_MAP: Record<string, string> = {
  gate1:     "gate.mp4",
  gate2:     "checkin.mp4",
  disembark: "disembark.mp4",
};

export const GET: APIRoute = async ({ params, request }) => {
  const zone = params.zone ?? "";
  const filename = VIDEO_MAP[zone];
  if (!filename) return new Response("Unknown zone", { status: 404 });

  const filePath = join(process.cwd(), "video_analytics", filename);

  let fileSize: number;
  try {
    const s = await stat(filePath);
    fileSize = s.size;
  } catch {
    return new Response("Video file not found", { status: 404 });
  }

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const [, rangeVal] = rangeHeader.split("=");
    const [startStr, endStr] = rangeVal.split("-");
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = createReadStream(filePath, { start, end });
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type":   "video/mp4",
      },
    });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type":   "video/mp4",
      "Content-Length": String(fileSize),
      "Accept-Ranges":  "bytes",
    },
  });
};
