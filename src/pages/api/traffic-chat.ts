import type { APIRoute } from "astro";
import { loadSnapshot } from "../../lib/video-flow";
import { chatQuery } from "../../lib/llm-dispatcher";
import type { ChatMessage } from "../../lib/llm-dispatcher";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: { message: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message field required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const snapshot = await loadSnapshot();
  const reply = await chatQuery(message, snapshot, history);

  return new Response(JSON.stringify({ reply, snapshot }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
