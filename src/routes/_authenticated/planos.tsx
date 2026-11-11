import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, planById, createMatrixPayCheckout } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { BookOpenCheck, Check, Clock, Crown, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos e pagamento | RuJe IA" },
      { name: "description", content: "Escolha o seu plano RuJe IA e pague com segurança pela MatrixPay." },
      { property: "og:title", content: "Planos e pagamento | RuJe IA" },
      { property: "og:description", content: "Planos semanais, de 14 e de 30 dias para criar trabalhos com IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Planos,
});

function statusLabel(s: string | null | undefined) {
  const v = String(s ?? "").toLowerCase();
  if (v.startsWith("pend")) return "A aguardar aprovação";
  if (v.startsWith("aprov") || v === "approved" || v === "pago") return "Aprovado";
  if (v.startsWith("rejeit") || v.startsWith("neg")) return "Recusado";
  return s ?? "—";
}

function Planos() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"mpesa" | "emola">("mpesa");

  const { data: sub } = useQuery({
    queryKey: ["subscription"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const pending = pedidos.find((p) => String(p.status ?? "").toLowerCase().startsWith("pend") && String(p.method ?? "").toLowerCase() === "matrixpay");
  const plan = selected ? planById(selected) : undefined;

  function choose(id: string) {
    setSelected(id);
    setTimeout(() => document.getElementById("pagamento")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function payWithMatrixPay() {
    if (!plan || busy || pending) return;
    setBusy(true);
    try {
      const result = await createMatrixPayCheckout({ productType: "plan", planId: plan.id, phone, method });
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else {
        if (result.pendingConfirmation) toast.warning("A MatrixPay ainda está a confirmar o pedido. Não repitas o pagamento; o estado será actualizado quando recebermos a confirmação.");
        else toast.success("Pedido enviado. Confirma a solicitação USSD no teu telemóvel.");
        await queryClient.invalidateQueries({ queryKey: ["my-payments"] });
        setBusy(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar pagamento MatrixPay.");
      setBusy(false);
    }
  }


  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="text-3xl font-extrabold">Planos RuJe IA</h1>
      <p className="text-muted-foreground mt-1">Escolha o que pretende comprar: acesso para criar trabalhos académicos ou o pacote de exames.</p>

      <section aria-label="Escolher produto" className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-primary bg-card p-5 sm:p-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold">Criar trabalhos académicos</h2>
          <p className="mt-2 text-sm text-muted-foreground">Escolha um plano para criar monografias, TCC, relatórios, seminários e outros trabalhos com IA.</p>
          <Button className="mt-5 w-full" onClick={() => document.getElementById("planos-trabalhos")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Ver planos para trabalhos
          </Button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpenCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-extrabold">Comprar exames</h2>
          <p className="mt-2 text-sm text-muted-foreground">Acesso ao pacote de exames por 125 MT, com opção de estudar os conteúdos e as respostas com IA.</p>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link to="/exames">Ver pacote de exames · 125 MT</Link>
          </Button>
        </div>
      </section>

      {sub && (
        <div className="mt-5 rounded-2xl border border-primary bg-secondary/60 p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Crown className="h-4 w-4 text-primary" /> Plano activo: {sub.plan}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {sub.daily_limit} trabalhos por dia · válido até {new Date(sub.expires_at).toLocaleDateString("pt-PT")}
          </p>
        </div>
      )}

      {pending && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary bg-card p-6">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-lg font-bold">Pedido enviado · a aguardar aprovação</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {pending.plan} · {pending.amount} MT · pedido criado em{" "}
              {new Date(pending.created_at).toLocaleDateString("pt-PT")}. O pagamento será confirmado automaticamente pela MatrixPay. Não inicie outro pedido enquanto este estiver em verificação.
            </p>
          </div>
        </div>
      )}
      <>
          <section id="planos-trabalhos" className="mt-8 scroll-mt-6">
            <h2 className="text-2xl font-extrabold">Planos para criar trabalhos</h2>
            <p className="text-muted-foreground mt-1 text-sm">Escolha a duração do acesso que melhor se adapta a si.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`shadow-soft flex flex-col rounded-2xl border-2 bg-card p-6 ${
                  selected === p.id ? "border-primary" : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="bg-brand w-fit rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                    Recomendado para começar
                  </span>
                )}
                <p className="mt-2 font-bold">{p.name}</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {p.price} <span className="text-base font-semibold">MT</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {p.days === 1 ? "1 dia de acesso" : `${p.days} dias de acesso`}
                </p>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {p.dailyLimit} trabalhos por dia
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> Exportação PDF e Word
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> Editor completo e partilha
                </p>
                {p.days >= 14 && (
                  <>
                    <p className="mt-1.5 flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" /> Geração e inserção de imagens com IA
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" /> Criação e exportação de PowerPoint
                    </p>
                  </>
                )}
                <Button className="mt-5 w-full" onClick={() => choose(p.id)}>
                  Pagar {p.name.replace("Plano ", "plano ")}
                </Button>
              </div>
            ))}
          </div>

          </section>

          {plan && (
            <section id="pagamento" className="shadow-soft mt-8 rounded-2xl border border-border bg-card p-6">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Pagamento seguro
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {plan.name} · {plan.price} MT
              </h2>

              <div className="mt-4 space-y-2"><label htmlFor="plan-payment-phone" className="text-sm font-medium">Número que será usado no pagamento</label><input id="plan-payment-phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="84... / 85... / 86... / 87..." className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" /><label htmlFor="plan-payment-method" className="text-sm font-medium">Método de pagamento</label><select id="plan-payment-method" value={method} onChange={(event) => setMethod(event.target.value as "mpesa" | "emola")} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="mpesa">M-Pesa</option><option value="emola">e-Mola</option></select><p className="text-muted-foreground text-xs">Confirma a solicitação USSD no número indicado.</p></div>
              <Button size="lg" className="mt-5 w-full" disabled={busy || Boolean(pending) || !phone.trim()} onClick={payWithMatrixPay}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Pagar agora · {plan.price} MT
              </Button>
              <p className="text-muted-foreground mt-2 text-xs">A activação do plano acontece automaticamente após a confirmação do pagamento.</p>
            </section>
          )}
        </>

      {pedidos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Os meus pedidos</h2>
          <div className="mt-4 grid gap-3">
            {pedidos.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 text-sm"
              >
                <span className="font-semibold">
                  {p.plan} · {p.amount} MT · {p.method}
                </span>
                <span className="text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString("pt-PT")} · <strong>{statusLabel(p.status)}</strong>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
