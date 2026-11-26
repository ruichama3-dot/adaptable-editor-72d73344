import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/plans";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";
const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const USSD_TIMEOUT_MS = 3 * 60 * 1000;
const PRODUCTS = { exams: { name: "Pacote de exames", amount: 125 }, cv: { name: "Currículo profissional", amount: 125 } } as const;
function normalizeMozPhone(value: unknown) { const digits = String(value ?? "").replace(/[^0-9]/g, ""); const local = digits.startsWith("258") ? digits.slice(3) : digits; return /^(82|83|84|85|86|87)\d{7}$/.test(local) ? local : null; }
function pickString(...values: unknown[]) { return values.find((value): value is string => typeof value === "string" && value.trim())?.trim(); }
function providerData(payload: any) {
  let value = payload;
  for (let depth = 0; depth < 4; depth++) {
    if (!value || typeof value !== "object" || Array.isArray(value)) break;
    if (value.payment && typeof value.payment === "object") { value = value.payment; continue; }
    if (value.data && typeof value.data === "object") { value = value.data; continue; }
    if (value.payload && typeof value.payload === "object") { value = value.payload; continue; }
    break;
  }
  return value && typeof value === "object" ? value : {};
}
export const Route = createFileRoute("/api/matrixpay/checkout")({
  server: { handlers: { POST: async ({ request }) => {
    let orderId: string | undefined;
    const checkoutStartedAt = Date.now();
    try {
      const apiKey = process.env.MATRIXPAY_API_KEY?.trim();
      const base = (process.env.MATRIXPAY_API_BASE_URL || "https://matrixpay.tech").replace(/\/$/, "");
      if (!apiKey) return reply({ error: "O serviço de pagamento está temporariamente indisponível. Tenta novamente mais tarde." }, 503);
      const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
      if (!accessToken) return reply({ error: "Sessão inválida. Entra novamente." }, 401);
      const body = await request.json() as { productType?: string; planId?: string; phone?: string; method?: string };
      const phone = normalizeMozPhone(body.phone);
      if (!phone) return reply({ error: "Indica um número moçambicano válido (82–87 e 7 dígitos)." }, 400);
      const method = String(body.method || "").toLowerCase();
      if (method !== "mpesa" && method !== "emola") return reply({ error: "Escolhe M-Pesa ou e-Mola." }, 400);
      const operatorNumberMatches = method === "mpesa" ? /^(84|85)\d{7}$/.test(phone) : /^(86|87)\d{7}$/.test(phone);
      if (!operatorNumberMatches) {
        return reply({
          error: method === "mpesa"
            ? "Este número não é M-Pesa. Para M-Pesa, usa um número iniciado por 84 ou 85; para 86 ou 87, selecciona e-Mola."
            : "Este número não é e-Mola. Para e-Mola, usa um número iniciado por 86 ou 87; para 84 ou 85, selecciona M-Pesa.",
        }, 400);
      }
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
      const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
      const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data: auth, error: authError } = await authClient.auth.getUser(accessToken);
      if (authError || !auth.user) return reply({ error: "Não foi possível validar a tua sessão. Entra novamente." }, 401);
      console.info("[MatrixPay] session verified", { durationMs: Date.now() - checkoutStartedAt });
      const plan = body.productType === "plan" ? PLANS.find((item) => item.id === body.planId) : undefined;
      const service = body.productType === "exams" ? PRODUCTS.exams : body.productType === "cv" ? PRODUCTS.cv : undefined;
      if (body.productType === "plan" && !plan) return reply({ error: "Plano inválido." }, 400);
      if (!plan && !service) return reply({ error: "Produto inválido." }, 400);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // The profile and pending-order reads are independent; run them together
      // so the normal checkout path avoids one serial database round-trip.
      const preflightStartedAt = Date.now();
      const [activeOrderResult, profileResult] = await Promise.all([
        supabaseAdmin.from("payment_requests").select("id, plan, amount, created_at").eq("user_id", auth.user.id).eq("method", "MatrixPay").in("status", ["pendente", "pending", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabaseAdmin.from("profiles").select("full_name,phone").eq("id", auth.user.id).maybeSingle(),
      ]);
      const { data: activeOrder, error: activeOrderError } = activeOrderResult;
      const profile = profileResult.data;
      if (activeOrderError) { console.error("[MatrixPay] active order lookup failed", activeOrderError.message); return reply({ error: "Não foi possível verificar um pagamento anterior. Aguarda um momento e tenta novamente." }, 503); }
      if (profileResult.error) console.warn("[MatrixPay] profile lookup failed", profileResult.error.message);
      console.info("[MatrixPay] preflight completed", { durationMs: Date.now() - preflightStartedAt });
      if (activeOrder) {
        const createdAt = new Date(activeOrder.created_at).getTime();
        const ussdExpired = Number.isFinite(createdAt) && Date.now() - createdAt >= USSD_TIMEOUT_MS;
        if (!ussdExpired) {
          return reply({ pending_confirmation: true, order_id: activeOrder.id, message: "Já existe um pedido USSD activo. Aguarda a resposta do telemóvel antes de iniciar outro." });
        }
        // Mobile-wallet USSD prompts normally expire after about three minutes.
        // Expire unanswered attempts so the customer can start a fresh attempt.
        const { error: expireError } = await supabaseAdmin.from("payment_requests").update({ status: "expirado" }).eq("id", activeOrder.id).in("status", ["pendente", "pending", "processing"]);
        if (expireError) {
          console.error("[MatrixPay] stale order expiry failed", expireError.message);
          return reply({ error: "O pedido anterior ainda está a ser verificado. Aguarda alguns segundos e tenta novamente." }, 503);
        }
      }
      const email = auth.user.email?.trim();
      if (!email) return reply({ error: "A conta precisa de um e-mail válido para emitir o recibo." }, 400);
      const amount = plan?.price ?? service!.amount;
      const productName = plan?.name ?? service!.name;
      const { data: order, error: orderError } = await supabaseAdmin.from("payment_requests").insert({
        user_id: auth.user.id, plan: productName, amount, method: "MatrixPay", full_name: profile?.full_name || email, phone, proof: "", status: "pendente",
      }).select("id").single();
      if (orderError || !order) { console.error("[MatrixPay] order insert failed", orderError?.message); return reply({ error: "Não foi possível criar o pedido de pagamento." }, 500); }
      orderId = order.id;
      console.info("[MatrixPay] local order created", { durationMs: Date.now() - checkoutStartedAt });
      const providerStartedAt = Date.now();
      const response = await fetch(`${base}/api/v1/payments`, {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ titulo: productName, valor: amount, cliente_email: email, referencia: order.id, cliente_nome: profile?.full_name || email, cliente_telefone: phone, metodo: method }),
        signal: AbortSignal.timeout(20000),
      });
      console.info("[MatrixPay] provider response received", { durationMs: Date.now() - providerStartedAt, status: response.status });
      const raw = await response.text();
      let json: any = {}; try { json = raw ? JSON.parse(raw) : {}; } catch { /* provider response not JSON */ }
      const data = providerData(json);
      const providerStatus = String(data?.status ?? json?.status ?? "").toLowerCase();
      if (/^(failed|falhou|rejected|rejeitado|declined|cancelled|canceled|expired|error)$/i.test(providerStatus)) {
        await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id).eq("status", "pendente");
        const providerMessage = pickString(data?.message, data?.error, json?.message, json?.error);
        return reply({ error: providerMessage ? `A MatrixPay recusou a criação da cobrança: ${providerMessage}` : "A MatrixPay não conseguiu iniciar a cobrança. Confirma se o número e o método estão corretos e tenta novamente." }, 402);
      }
      const providerId = pickString(data?.id, data?.payment_id, data?.paymentId, data?.transaction_id);
      const storedId = providerId || order.id;
      const checkoutUrl = pickString(data?.checkout_url, data?.payment_url, data?.payment_link, data?.url, data?.link, json?.checkout_url, json?.payment_url, json?.payment_link, json?.url);
      if (!response.ok) {
        const providerCode = pickString(json?.code, data?.code);
        const providerMessage = pickString(json?.message, json?.error, data?.message, data?.error);
        console.error("[MatrixPay] create payment failed", { status: response.status, code: providerCode || "unknown", amount, method, phoneSuffix: phone.slice(-2), response: raw.slice(0, 700) });
        await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
        if (response.status === 401 || response.status === 403) {
          return reply({ error: "Não foi possível iniciar o pagamento neste momento. Contacta o apoio da RuJe IA se o problema continuar." }, 502);
        }
        if (providerCode === "PAYMENT_FAILED" && providerMessage) {
          return reply({ error: `A MatrixPay não conseguiu iniciar a cobrança: ${providerMessage}` }, 502);
        }
        return reply({ error: providerMessage ? `Não foi possível iniciar o pagamento: ${providerMessage}` : "Não foi possível iniciar o pagamento. Tenta novamente." }, 502);
      }
      const { error: saveError } = await (supabaseAdmin.from("payment_requests") as any).update({ matrixpay_payment_id: storedId }).eq("id", order.id);
      if (saveError) { console.error("[MatrixPay] reference save failed", saveError.message); return reply({ error: "A cobrança foi criada, mas a referência não foi guardada. Contacta o apoio." }, 500); }
      console.info("[MatrixPay] checkout completed", { durationMs: Date.now() - checkoutStartedAt, awaitingUssd: !checkoutUrl });
      return reply({ checkout_url: checkoutUrl ?? null, payment_id: storedId, order_id: order.id, awaiting_ussd: !checkoutUrl, pending_confirmation: !checkoutUrl, message: !checkoutUrl ? "Pedido USSD enviado. Confirma a solicitação no teu telemóvel." : undefined });
    } catch (error) {
      const isTimeout = error instanceof Error && (error.name === "TimeoutError" || /timed? out|timeout/i.test(error.message));
      console.error("[MatrixPay] checkout error", { orderId: orderId || null, name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) });
      // A timeout is ambiguous: MatrixPay may have accepted the charge even if
      // our server did not receive its response. Keep the order pending so a
      // later webhook can safely confirm it and the user is not charged twice.
      if (orderId && isTimeout) {
        return reply({
          pending_confirmation: true,
          order_id: orderId,
          message: "A MatrixPay ainda não respondeu. O pedido ficou em verificação; não repitas o pagamento enquanto confirmamos o estado.",
        }, 202);
      }
      if (orderId) { try { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", orderId).eq("status", "pendente"); } catch { /* preserve original error */ } }
      return reply({ error: "Erro inesperado ao iniciar o pagamento. Tenta novamente mais tarde ou contacta o apoio se o valor tiver sido debitado." }, 500);
    }
  } } },
});
