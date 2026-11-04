import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/plans";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/config";

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const PRODUCTS = {
  exams: { key: "service:exams", name: "Pacote de exames", amount: 125, redirect: "https://rujeia.online/exames" },
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

          const token = process.env.RATIXPAY_API_TOKEN?.trim();
          const merchant = process.env.RATIXPAY_MERCHANT_ID?.trim();
          const base = (process.env.RATIXPAY_API_BASE_URL || "https://ratixpay.co.mz/v2").trim().replace(/\/$/, "");
          if (!token || !merchant) return reply({ error: "RatixPay não está configurada no servidor." }, 503);
          if (!/^https:\/\/(ratixpay\.co\.mz)(\/v2)?$/i.test(base)) {
            console.error("[RatixPay] unexpected API base URL", { host: (() => { try { return new URL(base).host; } catch { return "invalid"; } })() });
            return reply({ error: "A URL da API RatixPay está incorreta. Confirma a configuração do servidor." }, 503);
          }

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

          const headers = {
            Authorization: `Bearer ${token}`,
            "X-Merchant-Id": merchant,
            "Content-Type": "application/json",
            Accept: "application/json",
          };
          const { data: savedProduct } = await (supabaseAdmin.from("ratixpay_products") as any)
            .select("product_id").eq("plan_id", productKey).eq("amount", amount).maybeSingle();
          const configuredProductId = plan?.id === "teste"
            ? "3b1f17b0-3e7a-4e64-aabe-4bb38f9238e0"
            : undefined;
          let productId = configuredProductId || (savedProduct?.product_id as string | undefined);
          const expectedProductName = `RuJe IA - ${productName}`;
          const persistProduct = async (id: string) => {
            const { error: saveError } = await (supabaseAdmin.from("ratixpay_products") as any)
              .upsert({ plan_id: productKey, product_id: id, amount }, { onConflict: "plan_id" });
            if (saveError) throw new Error(`RatixPay product mapping save failed: ${saveError.message}`);
          };

          // The Diário 30 MT product was created in RatixPay manually.
          // Reuse its confirmed ID directly and persist the local mapping; do not call
          // the provider catalogue endpoints for this plan.
          if (configuredProductId) {
            try { await persistProduct(configuredProductId); } catch (saveError) {
              console.error("[RatixPay] configured product mapping save failed", saveError);
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              return reply({ error: "O produto Diário foi identificado, mas não foi possível guardar a associação na plataforma." }, 500);
            }
          }

          // Reuse an existing merchant-catalogue product before attempting catalogue creation.
          if (!productId) {
            const listRes = await fetch(`${base}/products`, { method: "GET", headers });
            const listText = await listRes.text();
            let listData: any = {};
            try { listData = listText ? JSON.parse(listText) : {}; } catch { /* non-JSON provider response */ }
            if (listRes.ok) {
              const candidates = Array.isArray(listData) ? listData :
                Array.isArray(listData?.data) ? listData.data :
                Array.isArray(listData?.products) ? listData.products :
                Array.isArray(listData?.data?.products) ? listData.data.products : [];
              const existing = candidates.find((item: any) =>
                String(item?.name || "").trim().toLowerCase() === expectedProductName.toLowerCase() &&
                Number(item?.price ?? item?.amount) === amount &&
                String(item?.currency || "MZN").toUpperCase() === "MZN" &&
                (item?.product_id || item?.id)
              );
              productId = existing?.product_id || existing?.id;
              if (productId) {
                try { await persistProduct(productId); } catch (saveError) {
                  console.error("[RatixPay] existing product mapping save failed", saveError);
                  await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
                  return reply({ error: "Encontrámos o produto na RatixPay, mas não foi possível associá-lo à tua conta." }, 500);
                }
              }
            } else {
              console.warn("[RatixPay] product list unavailable", listRes.status, listText.slice(0, 300));
            }
          }

          if (!productId) {
            const productRes = await fetch(`${base}/products`, {
              method: "POST", headers,
              body: JSON.stringify({
                name: expectedProductName, price: amount, currency: "MZN",
                callback_url: "https://www.rujeia.online/api/ratixpay-webhook",
                custom_metadata: { service: "ruje-ia", product_key: productKey },
              }),
            });
            const productText = await productRes.text();
            let productData: any = {};
            try { productData = productText ? JSON.parse(productText) : {}; } catch { /* non-JSON provider response */ }
            productId = productData?.product_id || productData?.data?.product_id;
            if (!productRes.ok || !productId) {
              console.error("[RatixPay] product create failed", productRes.status, productText.slice(0, 500));
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              const message = productRes.status === 403
                ? "A RatixPay recusou a criação do produto (403). Não foi encontrado um produto correspondente no catálogo. Pede ao suporte RatixPay para disponibilizar a criação de produtos via API ou cria o produto no painel e volta a tentar."
                : "A RatixPay não conseguiu disponibilizar o produto de pagamento. Verifica o catálogo e tenta novamente.";
              return reply({ error: message, provider_status: productRes.status }, 502);
            }
            try { await persistProduct(productId); } catch (saveError) {
              console.error("[RatixPay] product save failed", saveError);
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              return reply({ error: "O produto foi criado na RatixPay, mas não foi possível guardar a associação." }, 500);
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
          const checkoutText = await checkoutRes.text();
          let checkoutData: any = {};
          try { checkoutData = checkoutText ? JSON.parse(checkoutText) : {}; } catch { /* preserve non-JSON provider response for diagnosis */ }
          const checkoutPayload = checkoutData?.data ?? checkoutData;
          const paymentId = checkoutPayload?.payment_id;
          const checkoutUrl = checkoutPayload?.checkout_url;
          const checkoutAmount = Number(checkoutPayload?.amount);
          const checkoutCurrency = String(checkoutPayload?.currency || "").toUpperCase();
          const providerMessage = [checkoutData?.message, checkoutData?.error, checkoutData?.detail]
            .find((value) => typeof value === "string" && value.trim())?.trim().slice(0, 300);
          const providerCode = typeof checkoutData?.code === "string" ? checkoutData.code.slice(0, 100) : undefined;
          if (!checkoutRes.ok || !paymentId || !checkoutUrl ||
              !Number.isFinite(checkoutAmount) || checkoutAmount !== amount ||
              checkoutCurrency !== "MZN") {
            console.error("[RatixPay] checkout session rejected or returned invalid data", {
              status: checkoutRes.status,
              hasPaymentId: Boolean(paymentId),
              hasCheckoutUrl: Boolean(checkoutUrl),
              amountMatches: checkoutAmount === amount,
              currency: checkoutCurrency || "missing",
              providerCode,
              providerMessage,
              contentType: checkoutRes.headers.get("content-type"),
              requestId: checkoutRes.headers.get("x-request-id") || checkoutRes.headers.get("cf-ray"),
              providerResponse: checkoutText.slice(0, 800),
            });
            await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
            if (checkoutRes.status === 403) {
              return reply({
                error: providerMessage
                  ? `A RatixPay recusou a criação do checkout (HTTP 403): ${providerMessage}`
                  : "A RatixPay respondeu HTTP 403 ao pedido de checkout. A resposta técnica foi registada para identificar se é autenticação, permissões, produto ou validação do pedido. Nenhuma cobrança foi disponibilizada.",
                provider_status: 403,
                provider_code: providerCode,
              }, 502);
            }
            if (!checkoutRes.ok) {
              return reply({
                error: `A RatixPay recusou a criação do checkout (HTTP ${checkoutRes.status}). Tenta novamente mais tarde ou contacta o suporte.`,
                provider_status: checkoutRes.status,
              }, 502);
            }
            return reply({ error: "A RatixPay criou uma resposta incompleta ou com valor/moeda diferentes do pedido. O pagamento não foi disponibilizado." }, 502);
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
