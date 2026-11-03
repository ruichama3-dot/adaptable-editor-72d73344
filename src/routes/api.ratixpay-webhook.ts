import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/ratixpay-webhook")({
  server: {
    handlers: {
      GET: async () => reply({ ok: true, service: "ruje-ia-ratixpay-webhook" }),
      POST: async ({ request }) => {
        const secret = process.env.RATIXPAY_WEBHOOK_SECRET;
        if (!secret) return reply({ error: "webhook_not_configured" }, 503);
        const rawBody = await request.text();
        let event: any;
        try { event = JSON.parse(rawBody); } catch { return reply({ error: "invalid_json" }, 400); }
        const received = request.headers.get("x-ratixpay-signature") || "";
        const expected = createHmac("sha256", secret).update(JSON.stringify(event)).digest("hex");
        const a = Buffer.from(expected, "hex");
        const b = Buffer.from(received, "hex");
        if (!/^[a-f0-9]{64}$/i.test(received) || a.length !== b.length || !timingSafeEqual(a, b))
          return reply({ error: "invalid_signature" }, 401);
        if (event?.event !== "venda.aprovada" || String(event?.status).toLowerCase() !== "approved")
          return reply({ ok: true, ignored: true });

        const paymentId = String(event.payment_id || "");
        const orderId = String(event.order_id || "");
        if (!paymentId || !orderId) return reply({ error: "missing_reference" }, 400);
        try {
          const token = process.env.RATIXPAY_API_TOKEN;
          const merchant = process.env.RATIXPAY_MERCHANT_ID;
          const base = (process.env.RATIXPAY_API_BASE_URL || "https://ratixpay.co.mz/v2").replace(/\/$/, "");
          if (!token || !merchant) return reply({ error: "provider_not_configured" }, 503);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: order, error } = await (supabaseAdmin.from("payment_requests") as any)
            .select("id,user_id,plan,amount,status,ratixpay_payment_id").eq("id", orderId).maybeSingle();
          if (error || !order) return reply({ error: "order_not_found" }, 404);
          if (order.ratixpay_payment_id !== paymentId) return reply({ error: "payment_mismatch" }, 409);
          if (/^(aprovado|approved|pago|paid)$/i.test(String(order.status || "")))
            return reply({ ok: true, already_processed: true });

          const check = await fetch(`${base}/payment-status/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: `Bearer ${token}`, "X-Merchant-Id": merchant },
          });
          const verified = await check.json().catch(() => ({})) as any;
          if (!check.ok || verified?.data?.status !== "approved" ||
              Number(verified?.data?.amount) !== Number(order.amount) ||
              String(verified?.data?.currency).toUpperCase() !== "MZN")
            return reply({ error: "payment_not_verified" }, 409);

          const plan = ({
            "Plano 1 dia": { days: 1, dailyLimit: 2, amount: 30 },
            "Plano Semanal": { days: 7, dailyLimit: 2, amount: 150 },
            "Plano 14 dias": { days: 14, dailyLimit: 4, amount: 250 },
            "Plano 30 dias": { days: 30, dailyLimit: 10, amount: 400 },
          } as Record<string, {days:number;dailyLimit:number;amount:number}>)[order.plan];

          if (plan) {
            if (plan.amount !== Number(order.amount)) return reply({ error: "plan_amount_mismatch" }, 409);
            const { data: result, error: rpcError } = await supabaseAdmin.rpc("confirm_ratixpay_payment", {
              p_payment_request_id: order.id, p_payment_id: paymentId, p_plan: order.plan,
              p_daily_limit: plan.dailyLimit, p_days: plan.days,
            });
            if (rpcError || !(result as any)?.ok) {
              console.error("[RatixPay] Activation error", rpcError?.message || result);
              return reply({ error: "activation_failed" }, 500);
            }
            return reply({ ok: true, activated: true, already_processed: Boolean((result as any).already_processed) });
          }

          const validService = (["Pacote de exames", "Pacote de exames 12.ª classe", "Currículo profissional"].includes(order.plan)) && Number(order.amount) === 125;
          if (!validService) return reply({ error: "unknown_order_product" }, 409);
          const { data: updatedOrder, error: updateError } = await supabaseAdmin.from("payment_requests")
            .update({ status: "aprovado" })
            .eq("id", order.id)
            .eq("status", "pendente")
            .select("id")
            .maybeSingle();
          if (updateError) {
            console.error("[RatixPay] Service entitlement update failed", updateError.message);
            return reply({ error: "entitlement_update_failed" }, 500);
          }
          if (!updatedOrder) {
            // A concurrent/retried webhook may already have fulfilled this same order.
            const { data: latestOrder, error: latestError } = await supabaseAdmin
              .from("payment_requests")
              .select("status")
              .eq("id", order.id)
              .maybeSingle();
            if (!latestError && /^(aprovado|approved|pago|paid)$/i.test(String(latestOrder?.status || ""))) {
              return reply({ ok: true, unlocked: order.plan, already_processed: true });
            }
            return reply({ error: "order_not_pending" }, 409);
          }
          return reply({ ok: true, unlocked: order.plan, already_processed: false });
        } catch (error) {
          console.error("[RatixPay] Webhook error", error);
          return reply({ error: "internal_error" }, 500);
        }
      },
    },
  },
});
