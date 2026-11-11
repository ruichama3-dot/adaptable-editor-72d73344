import { createFileRoute } from "@tanstack/react-router";
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const isApproved = (value: unknown) => /^(approved|aprovado|paid|pago|completed|liquidado)$/i.test(String(value ?? ""));
const numeric = (value: unknown) => Number(String(value ?? "").replace(",", "."));
export const Route = createFileRoute("/api/matrixpay-webhook")({
  server: { handlers: {
    GET: async () => reply({ ok: true, service: "ruje-ia-matrixpay-webhook", method: "POST" }),
    POST: async ({ request }) => {
      const apiKey = process.env.MATRIXPAY_API_KEY?.trim();
      const base = (process.env.MATRIXPAY_API_BASE_URL || "https://matrixpay.tech").replace(/\/$/, "");
      if (!apiKey) return reply({ error: "provider_not_configured" }, 503);
      let event: any; try { event = await request.json(); } catch { return reply({ error: "invalid_json" }, 400); }
      if (event?.event !== "payment.approved") return reply({ ok: true, ignored: true });
      const payload = event?.data ?? event?.payment ?? {};
      const reference = String(payload?.external_reference || payload?.referencia || payload?.reference || "");
      const eventPaymentId = String(payload?.id || payload?.payment_id || "");
      if (!reference) return reply({ error: "missing_external_reference" }, 400);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order, error } = await (supabaseAdmin.from("payment_requests") as any).select("id,user_id,plan,amount,status,matrixpay_payment_id").eq("id", reference).maybeSingle();
        if (error || !order) return reply({ error: "order_not_found" }, 404);
        if (eventPaymentId && order.matrixpay_payment_id && order.matrixpay_payment_id !== order.id && eventPaymentId !== order.matrixpay_payment_id) return reply({ error: "payment_mismatch" }, 409);
        if (/^(aprovado|approved|pago|paid)$/i.test(String(order.status || ""))) return reply({ ok: true, already_processed: true });
        const lookup = eventPaymentId || reference;
        const check = await fetch(`${base}/api/v1/payments/${encodeURIComponent(lookup)}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
        const checkJson = await check.json().catch(() => ({})) as any;
        const verified = checkJson?.data ?? checkJson?.payment ?? checkJson;
        const verifiedReference = String(verified?.external_reference || verified?.referencia || verified?.reference || "");
        const verifiedId = String(verified?.id || verified?.payment_id || "");
        const verifiedAmount = numeric(verified?.valor ?? verified?.amount);
        const verifiedCurrency = String(verified?.moeda || verified?.currency || "MZN").toUpperCase();
        if (!check.ok || !isApproved(verified?.status) || (verifiedReference && verifiedReference !== order.id) ||
            (verifiedId && order.matrixpay_payment_id && order.matrixpay_payment_id !== order.id && verifiedId !== order.matrixpay_payment_id) ||
            verifiedAmount !== Number(order.amount) || verifiedCurrency !== "MZN") return reply({ error: "payment_not_verified" }, 409);
        const plans: Record<string, { days: number; dailyLimit: number; amount: number }> = {
          "Plano 1 dia": { days: 1, dailyLimit: 2, amount: 30 }, "Plano Semanal": { days: 7, dailyLimit: 2, amount: 150 },
          "Plano 14 dias": { days: 14, dailyLimit: 4, amount: 250 }, "Plano 30 dias": { days: 30, dailyLimit: 10, amount: 400 },
        };
        const plan = plans[order.plan];
        if (plan) {
          if (plan.amount !== Number(order.amount)) return reply({ error: "plan_amount_mismatch" }, 409);
          const { data: result, error: rpcError } = await (supabaseAdmin as any).rpc("confirm_matrixpay_payment", {
            p_payment_request_id: order.id, p_payment_id: order.matrixpay_payment_id, p_plan: order.plan, p_daily_limit: plan.dailyLimit, p_days: plan.days,
          });
          if (rpcError || !result?.ok) { console.error("[MatrixPay] activation failed", rpcError?.message || result); return reply({ error: "activation_failed" }, 500); }
          return reply({ ok: true, activated: true, already_processed: Boolean(result.already_processed) });
        }
        const validService = ["Pacote de exames", "Pacote de exames 12.ª classe", "Currículo profissional"].includes(order.plan) && Number(order.amount) === 125;
        if (!validService) return reply({ error: "unknown_order_product" }, 409);
        const { data: updated, error: updateError } = await supabaseAdmin.from("payment_requests").update({ status: "aprovado" }).eq("id", order.id).eq("status", "pendente").select("id").maybeSingle();
        if (updateError) return reply({ error: "entitlement_update_failed" }, 500);
        if (!updated) {
          const { data: latest } = await supabaseAdmin.from("payment_requests").select("status").eq("id", order.id).maybeSingle();
          if (/^(aprovado|approved|pago|paid)$/i.test(String(latest?.status || ""))) return reply({ ok: true, unlocked: order.plan, already_processed: true });
          return reply({ error: "order_not_pending" }, 409);
        }
        return reply({ ok: true, unlocked: order.plan });
      } catch (error) { console.error("[MatrixPay] webhook error", error); return reply({ error: "internal_error" }, 500); }
    },
  } },
});
