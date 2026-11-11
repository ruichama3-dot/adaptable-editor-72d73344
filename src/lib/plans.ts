import { supabase } from "@/integrations/supabase/client";

export async function createMatrixPayCheckout(input: { productType: "plan" | "exams" | "cv"; phone: string; method: "mpesa" | "emola"; planId?: string }): Promise<{ checkoutUrl: string | null; pendingConfirmation: boolean }> {
  const sendCheckout = async (accessToken: string) => fetch("/api/matrixpay/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  // Reuse the current session for the common case. Refresh only when the
  // token is missing or close to expiry, avoiding an unnecessary auth round-trip
  // before every checkout attempt.
  const sessionResult = await supabase.auth.getSession();
  let token = sessionResult.data.session?.access_token;
  const expiresAt = sessionResult.data.session?.expires_at ?? 0;
  if (!token || expiresAt * 1000 <= Date.now() + 60_000) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
  }
  if (!token) {
    throw new Error("Não foi possível validar a tua conta. Termina a sessão, entra novamente e tenta pagar.");
  }

  let response = await sendCheckout(token);
  if (response.status === 401) {
    // A refresh token may have rotated while another tab was active. Refresh once more.
    const retryRefresh = await supabase.auth.refreshSession();
    const retryToken = retryRefresh.data.session?.access_token;
    if (retryRefresh.error || !retryToken) {
      throw new Error("A sessão da tua conta expirou. Entra novamente para continuar o pagamento.");
    }
    response = await sendCheckout(retryToken);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o pagamento.");
  return {
    checkoutUrl: result.checkout_url ? String(result.checkout_url) : null,
    pendingConfirmation: result.pending_confirmation === true,
  };
}

export type Plan = {
  id: string;
  name: string;
  price: number;
  days: number;
  dailyLimit: number;
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  { id: "teste", name: "Plano 1 dia", price: 30, days: 1, dailyLimit: 2, highlight: true },
  { id: "semanal", name: "Plano Semanal", price: 150, days: 7, dailyLimit: 2 },
  { id: "quinzenal", name: "Plano 14 dias", price: 250, days: 14, dailyLimit: 4 },
  { id: "mensal", name: "Plano 30 dias", price: 400, days: 30, dailyLimit: 10 },
];

export const PAYMENT_METHODS = [
  { id: "emola", name: "Emola", number: "872954503", holder: "Laura Ermelindo" },
  { id: "mpesa", name: "M-Pesa", number: "851589567", holder: "JEREMIAS NIUONENO ROMAO" },
];

export const FREE_DAILY_LIMIT = 0;


export function planById(id: string | null | undefined): Plan | undefined {
  const k = String(id ?? "").trim().toLowerCase();
  return PLANS.find((p) => p.id === k || p.name.toLowerCase() === k);
}
