import { createFileRoute } from "@tanstack/react-router";
import { PLANS } from "@/lib/plans";

const reply = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/ratixpay/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const bearer = request.headers.get("authorization") || "";
          const accessToken = bearer.replace(/^Bearer\s+/i, "").trim();
          if (!accessToken) return reply({ error: "Sessão inválida. Entre novamente." }, 401);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
          if (authError || !auth.user) return reply({ error: "Sessão inválida. Entre novamente." }, 401);

          const body = await request.json() as { planId?: string; phone?: string };
          const plan = PLANS.find((item) => item.id === body.planId);
          if (!plan) return reply({ error: "Plano inválido." }, 400);
          const token = process.env.RATIXPAY_API_TOKEN;
          const merchant = process.env.RATIXPAY_MERCHANT_ID;
          const base = (process.env.RATIXPAY_API_BASE_URL || "https://ratixpay.co.mz/v2").replace(/\/$/, "");
          if (!token || !merchant) return reply({ error: "RatixPay não configurada no servidor." }, 503);

          const { data: profile } = await supabaseAdmin.from("profiles").select("full_name,phone").eq("id", auth.user.id).maybeSingle();
          const fullName = profile?.full_name || auth.user.email || "Cliente RuJe IA";
          const phone = String(body.phone || profile?.phone || "").trim();
          const { data: order, error: orderError } = await supabaseAdmin.from("payment_requests").insert({
            user_id: auth.user.id, plan: plan.name, amount: plan.price, method: "RatixPay",
            full_name: fullName, phone: phone || "Não informado", proof: "", status: "pendente",
          }).select("id").single();
          if (orderError || !order) {
            console.error("[RatixPay] order insert failed", orderError?.message);
            return reply({ error: "Não foi possível iniciar o pedido de pagamento." }, 500);
          }

          const headers = { Authorization: `Bearer ${token}`, "X-Merchant-Id": merchant, "Content-Type": "application/json" };
          const { data: savedProduct } = await (supabaseAdmin.from("ratixpay_products") as any)
            .select("product_id").eq("plan_id", plan.id).eq("amount", plan.price).maybeSingle();
          let productId = savedProduct?.product_id as string | undefined;
          if (!productId) {
            const productRes = await fetch(`${base}/products`, {
              method: "POST", headers,
              body: JSON.stringify({
                name: `RuJe IA - ${plan.name}`, price: plan.price, currency: "MZN",
                callback_url: "https://rujeia.online/api/ratixpay/webhook",
                custom_metadata: { service: "ruje-ia", plan_id: plan.id },
              }),
            });
            const productData = await productRes.json().catch(() => ({})) as any;
            productId = productData?.product_id || productData?.data?.product_id;
            if (!productRes.ok || !productId) {
              console.error("[RatixPay] product create failed", productRes.status, productData);
              await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
              return reply({ error: "A RatixPay não conseguiu criar o produto de pagamento." }, 502);
            }
            const { error: saveProductError } = await (supabaseAdmin.from("ratixpay_products") as any)
              .upsert({ plan_id: plan.id, product_id: productId, amount: plan.price }, { onConflict: "plan_id" });
            if (saveProductError) {
              console.error("[RatixPay] product id save failed", saveProductError.message);
              return reply({ error: "Não foi possível guardar a configuração do produto." }, 500);
            }
          }

          await (supabaseAdmin.from("payment_requests") as any)
            .update({ ratixpay_product_id: productId }).eq("id", order.id);

          const checkoutRes = await fetch(`${base}/checkout/session`, {
            method: "POST", headers,
            body: JSON.stringify({
              product_id: productId,
              customer: { nome: fullName, email: auth.user.email || undefined, telefone: phone || undefined },
              redirect_url: "https://rujeia.online/planos",
              cancel_url: "https://rujeia.online/planos",
              custom_metadata: { order_id: order.id, plan_id: plan.id },
            }),
          });
          const checkoutData = await checkoutRes.json().catch(() => ({})) as any;
          const paymentId = checkoutData?.data?.payment_id;
          const checkoutUrl = checkoutData?.data?.checkout_url;
          if (!checkoutRes.ok || !paymentId || !checkoutUrl) {
            console.error("[RatixPay] checkout create failed", checkoutRes.status, checkoutData);
            await supabaseAdmin.from("payment_requests").update({ status: "falhou" }).eq("id", order.id);
            return reply({ error: "Não foi possível criar a página de pagamento." }, 502);
          }
          const { error: updateError } = await (supabaseAdmin.from("payment_requests") as any)
            .update({ ratixpay_payment_id: paymentId }).eq("id", order.id);
          if (updateError) {
            console.error("[RatixPay] payment id save failed", updateError.message);
            return reply({ error: "A cobrança foi criada, mas não foi possível guardar a referência." }, 500);
          }
          return reply({ checkout_url: checkoutUrl });
        } catch (error) {
          console.error("[RatixPay] checkout error", error);
          return reply({ error: "Erro inesperado ao iniciar o pagamento." }, 500);
        }
      },
    },
  },
});
