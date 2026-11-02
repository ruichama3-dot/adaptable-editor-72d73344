import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/plans";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const PRODUCTS = {
  exams: { key: "service:exams", name: "Pacote de exames 12.ª classe", amount: 125, redirect: "https://rujeia.online/exames" },
  cv: { key: "service:cv", name: "Currículo profissional", amount: 125, redirect: "https://rujeia.online/curriculo" },
} as const;

function normalizeMozPhone(value: unknown) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  const local = digits.startsWith("258") ? digits.slice(3) : digits;
  return /^(82|83|84|85|86|87)\d{7}$/.test(local) ? local : null;
}

export const Route = createFileRoute("/api/ratixpay/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let orderId: string | undefined;
        try {
          const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
          if (!accessToken) return reply({ error: "Sessão inválida. Atualiza a página e entra novamente." }, 401);
          const body = await request.json() as { productType?: string; planId?: string; phone?: string };
          const phone = normalizeMozPhone(body.phone);
          if (!phone) return reply({ error: "Indica um número moçambicano válido (82–87 e 7 dígitos)." }, 400);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Verify the user's JWT against the same public Supabase project used by
          // the browser. Do not use the service-role client's auth storage/session.
          const supabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || DEFAULT_SUPABASE_URL;
          const publishableKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
            process.env["SUPABASE_PUBLISHABLE_KEY"] || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
          const authClient = createClient(supabaseUrl, publishableKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
          const { data: auth, error: authError } = await authClient.auth.getUser(accessToken);
          if (authError || !auth.user) {
            console.error("[RatixPay] Supabase user-token verification failed", {
              code: authError?.code || "NO_USER",
              status: authError?.status || 0,
              message: authError?.message || "No authenticated user returned",
              supabaseHost: new URL(supabaseUrl).host,
            });
            return reply({ error: "Não foi possível validar a tua sessão nesta plataforma. Sai da conta, entra novamente e tenta outra vez." }, 401);
          }

          const plan = body.productType === "plan" ? PLANS.find((item) => item.id === body.planId) : undefined;
          const service = body.productType === "exams" ? PRODUCTS.exams : body.productType === "cv" ? PRODUCTS.cv : undefined;
          if (body.productType === "plan" && !plan) return reply({ error: "Plano inválido." }, 400);
          if (!plan && !service) return reply({ error: "Produto inválido." }, 400);

          const token = process.env.RATIXPAY_API_TOKEN;
          const merchant = process.env.RATIXPAY_MERCHANT_ID;
          const base = (process.env.RATIXPAY_API_BASE_URL || "https://ratixpay.co.mz/v2").replace(/\/$/, "");
          if (!token || !merchant) return reply({ error: "RatixPay não está configurada no servidor." }, 503);

          const { data: profile } = await supabaseAdmin.from("profiles").select("full_name,phone").eq("id", auth.user.id).maybeSingle();
          const fullName = profile?.full_name || auth.user.email || "Cliente RuJe IA";
          const amount = plan?.price ?? service!.amount;
          const productName = plan?.name ?? service!.name;
          const productKey = plan?.id ?? service!.key;
          const redirect = plan ? "https://rujeia.online/planos" : service!.redirect;

          const { data: order, error: orderError } = await supabaseAdmin.from("payment_requests").insert({
            user_id: auth.user.id, plan: productName, amount, method: "RatixPay",
            full_name: fullName, phone, proof: "", status: "pendente",
          }).select("id").single();
          if (orderError || !order) {
            console.error("[RatixPay] order insert failed", orderError?.message);
            return reply({ error: "Não foi possível criar o pedido de pagamento." }, 500);
          }
          orderId = order.id;

          const headers = { Authorization: `Bearer ${token}`, "X-Merchant-Id": merchant, "Content-Type": "application/json" };
          const { data: savedProduct } = await (supabaseAdmin.from("ratixpay_products") as any)
            .select("product_id").eq("plan_id", productKey).eq("amount", amount).maybeSingle();
          let productId = savedProduct?.product_id as string | undefined;
          if (!productId) {
            const productRes = await fetch(`${base}/products`, {
              method: "POST", headers,
              body: JSON.stringify({
                name: `RuJe IA - ${productName}`, price: amount, currency: "MZN",
                callback_url: "https://www.rujeia.online/api/ratixpay/webhook",
                custom_metadata: { service: "ruje-ia", product_key: productKey },
              }),
            });
            const productData = await productRes.json().catch(() => ({})) as any;
            productId = productData?.product_id || productData?.data?.product_id;
            if (!productRes.ok || !productId) {
              console.error("[RatixPay] product create failed", productRes.status, productData);
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              return reply({ error: "A RatixPay não conseguiu criar o produto de pagamento." }, 502);
            }
            const { error: saveError } = await (supabaseAdmin.from("ratixpay_products") as any)
              .upsert({ plan_id: productKey, product_id: productId, amount }, { onConflict: "plan_id" });
            if (saveError) {
              console.error("[RatixPay] product save failed", saveError.message);
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              return reply({ error: "Não foi possível guardar o produto RatixPay." }, 500);
            }
          }

          await (supabaseAdmin.from("payment_requests") as any)
            .update({ ratixpay_product_id: productId }).eq("id", order.id);

          const checkoutRes = await fetch(`${base}/checkout/session`, {
            method: "POST", headers,
            body: JSON.stringify({
              product_id: productId,
              customer: { nome: fullName, email: auth.user.email || undefined, telefone: phone },
              redirect_url: redirect,
              cancel_url: redirect,
              custom_metadata: { order_id: order.id, product_key: productKey, user_id: auth.user.id },
            }),
          });
          const checkoutData = await checkoutRes.json().catch(() => ({})) as any;
          const paymentId = checkoutData?.data?.payment_id;
          const checkoutUrl = checkoutData?.data?.checkout_url;
          if (!checkoutRes.ok || !paymentId || !checkoutUrl) {
            console.error("[RatixPay] checkout create failed", checkoutRes.status, checkoutData);
            await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
            return reply({ error: "Não foi possível criar a página de pagamento RatixPay." }, 502);
          }
          const { error: updateError } = await (supabaseAdmin.from("payment_requests") as any)
            .update({ ratixpay_payment_id: paymentId }).eq("id", order.id);
          if (updateError) {
            console.error("[RatixPay] payment id save failed", updateError.message);
            return reply({ error: "A cobrança foi criada, mas a referência não foi guardada. Contacta o apoio." }, 500);
          }
          return reply({ checkout_url: checkoutUrl, order_id: order.id });
        } catch (error) {
          console.error("[RatixPay] checkout error", error);
          return reply({ error: "Erro inesperado ao iniciar o pagamento." }, 500);
        }
      },
    },
  },
});
