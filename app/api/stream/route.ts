import { Client } from "pg";
import { setDefaultResultOrder } from "dns";

setDefaultResultOrder("ipv4first");

export const dynamic = "force-dynamic"; // never cache/prerender an SSE stream

/**
 * GET /api/stream
 *
 * This is the real-time layer: instead of the frontend polling every
 * few seconds, the DATABASE tells us the instant a seat's state
 * changes (via the pg_notify calls baked into our triggers), and we
 * forward that straight to the browser as a Server-Sent Event.
 *
 * One dedicated `pg.Client` connection per open browser tab is what
 * LISTEN/NOTIFY requires — it's not something you can do over
 * Prisma's pooled connections, hence the raw `pg` client here.
 */
export async function GET() {
  const encoder = new TextEncoder();
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 20000,
  });

  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      await pgClient.connect();
      await pgClient.query("LISTEN seat_updates");

      const send = (data: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      pgClient.on("notification", (msg) => {
        if (msg.channel === "seat_updates" && msg.payload) {
          send(msg.payload);
        }
      });

      // Heartbeat so intermediary proxies/load balancers don't kill an
      // idle connection, and so the browser's EventSource reconnect
      // logic has something to notice if the server actually died.
      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30_000);

      // Cleanup when the client disconnects (tab closed, navigated away)
      const cleanup = async () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          await pgClient.query("UNLISTEN seat_updates");
          await pgClient.end();
        } catch {
          // connection may already be dead — nothing more to do
        }
      };

      // @ts-expect-error — Next's ReadableStream typing doesn't expose
      // the underlying request signal here; this is the documented way
      // to detect client disconnect for edge/node runtimes.
      controller.signal?.addEventListener?.("abort", cleanup);
      pgClient.on("end", cleanup);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
