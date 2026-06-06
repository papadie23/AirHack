// Shared in-memory store for real-time announcements.
// Module-level singletons are shared across all requests within a single
// Node.js process (dev server / single-instance deploy).
// On Vercel's multi-instance serverless the state is per-instance; for a
// single-device or local demo this is perfectly fine.

export interface StoredAnnouncement {
  id: number;
  type: "info" | "warning" | "danger";
  text: string;
  time: string;
}

export const announcements: StoredAnnouncement[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const subscribers = new Set<ReadableStreamDefaultController<any>>();
