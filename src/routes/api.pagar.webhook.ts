import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function verifyWebhookSignature(secret: string, rawBody: string, header: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return index < 0 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
  const timestamp = parts.t ?? "";
  const received = parts.v1 ?? "";

  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(received)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(timestamp + "." + rawBody)
    .digest("hex");
  const receivedBytes = Buffer.from(received, "hex");
  const expectedBytes = Buffer.from(expected, "hex");

  return receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes);
}

export const Route = createFileRoute("/api/pagar/webhook")({
  server: {
    handlers: {
      GET: async () =>
        json({
          ok: true,
          service: "ruje-ia-pagar-webhook",
          webhookSecretConfigured: Boolean(process.env.PAGAR_WEBHOOK_SECRET),
          method: "POST",
        }),
      POST: async ({ request }) => {
        const secret = process.env.PAGAR_WEBHOOK_SECRET?.trim();
        if (!secret) {
          return json({ ok: false, error: "webhook_not_configured" }, 503);
        }

        const eventId = request.headers.get("Pagar-Event-Id");
        const signature = request.headers.get("Pagar-Signature") ?? "";
        if (!eventId) return json({ ok: false, error: "missing_event_id" }, 400);

        const rawBody = await request.text();
        if (!verifyWebhookSignature(secret, rawBody, signature)) {
          return json({ ok: false, error: "invalid_signature" }, 401);
        }

        let event: { type?: string; event?: string };
        try {
          event = JSON.parse(rawBody) as { type?: string; event?: string };
        } catch {
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        const eventType = event.type ?? event.event ?? "";
        if (eventType === "webhook.test") {
          return json({ ok: true, received: true, eventId });
        }

        // Payment events are deliberately not acknowledged until the order,
        // amount, user and idempotent subscription update are wired to the DB.
        return json(
          {
            ok: false,
            error: "payment_event_processing_not_configured",
            eventId,
          },
          503,
        );
      },
    },
  },
});
