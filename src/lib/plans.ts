import { supabase } from "@/integrations/supabase/client";

export async function createRatixPayCheckout(input: { productType: "plan" | "exams" | "cv"; phone: string; planId?: string }) {
  let { data, error } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (error || !token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
    error = refreshed.error;
  }
  if (error || !token) throw new Error("A sessão expirou. Atualiza a página e entra novamente.");
  const response = await fetch("/api/ratixpay/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.checkout_url) throw new Error(result.error || "Não foi possível iniciar o pagamento.");
  return String(result.checkout_url);
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
