import type { APIRoute } from "astro";
import { announcements, subscribers } from "../../lib/announce-store";

const encoder = new TextEncoder();

function broadcast(data: object) {
  const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const ctrl of subscribers) {
    try { ctrl.enqueue(chunk); }
    catch { subscribers.delete(ctrl); }
  }
}

// GET — SSE stream: clients subscribe here to receive announcements in real time.
// On connect, all existing announcements are replayed so late-joining clients
// get the full history immediately.
export const GET: APIRoute = () => {
  // eslint-disable-next-line prefer-const
  let ctrl: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller;
      // Keep-alive comment so the browser knows the connection is open
      controller.enqueue(encoder.encode(": connected\n\n"));
      // Replay history for this client
      for (const a of announcements) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(a)}\n\n`));
      }
      subscribers.add(controller);
    },
    cancel() {
      subscribers.delete(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // prevents Nginx from buffering SSE
    },
  });
};

// POST — admin sends a new announcement; it is stored and broadcast to everyone.
export const POST: APIRoute = async ({ request }) => {
  let body: { text?: string; type?: string };
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

  const text = (body.text ?? "").trim();
  if (!text) {
    return new Response(JSON.stringify({ error: "empty" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const validTypes = ["info", "warning", "danger"] as const;
  const type = validTypes.includes(body.type as typeof validTypes[number])
    ? (body.type as typeof validTypes[number])
    : "warning";

  const announcement = {
    id: Date.now(),
    type,
    text,
    time: new Date().toLocaleTimeString("ro", { hour: "2-digit", minute: "2-digit" }),
  };

  announcements.push(announcement);
  broadcast(announcement);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
