import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, PAYMENT_METHODS, planById } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, CheckCircle2, Clock, Copy, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({
    meta: [
      { title: "Planos e pagamento | RuJe IA" },
      { name: "description", content: "Escolha o seu plano RuJe IA e pague por Emola ou M-Pesa." },
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]!.id);
  const [busy, setBusy] = useState(false);

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

  const pending = pedidos.find((p) => String(p.status ?? "").toLowerCase().startsWith("pend"));
  const plan = selected ? planById(selected) : undefined;
  const pay = PAYMENT_METHODS.find((m) => m.id === method)!;

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    toast.success(`Número ${text} copiado!`);
  }

  function choose(id: string) {
    setSelected(id);
    setStep(2);
    setTimeout(() => document.getElementById("pagamento")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!plan || busy || pending) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      plan: plan.name,
      amount: plan.price,
      method: pay.name,
      full_name: String(f.get("full_name") ?? "").trim(),
      phone: String(f.get("phone") ?? "").trim(),
      proof: String(f.get("proof") ?? "").trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o comprovativo. Tente novamente.");
      return;
    }
    form.reset();
    setStep(1);
    setSelected(null);
    void queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    void queryClient.invalidateQueries({ queryKey: ["my-pending-payment"] });
    toast.success("Comprovativo enviado! Aguarde a aprovação do administrador.");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="text-3xl font-extrabold">Planos RuJe IA</h1>
      <p className="text-muted-foreground mt-1">Escolha o plano, pague por Emola ou M-Pesa e envie o comprovativo.</p>

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

      {pending ? (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary bg-card p-6">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-lg font-bold">Pedido enviado · a aguardar aprovação</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {pending.plan} · {pending.amount} MT via {pending.method}, enviado em{" "}
              {new Date(pending.created_at).toLocaleDateString("pt-PT")}. O administrador está a verificar o seu
              comprovativo. Poderá fazer um novo pedido depois de este ser aprovado ou recusado.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`shadow-soft flex flex-col rounded-2xl border-2 bg-card p-6 ${
                  selected === p.id ? "border-primary" : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="bg-brand w-fit rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                    Mais popular
                  </span>
                )}
                <p className="mt-2 font-bold">{p.name}</p>
                <p className="mt-2 text-3xl font-extrabold">
                  {p.price} <span className="text-base font-semibold">MT</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">{p.days} dias de acesso</p>
                <p className="mt-3 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {p.dailyLimit} trabalhos por dia
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> Exportação PDF e Word
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> Editor completo e partilha
                </p>
                <Button className="mt-5 w-full" onClick={() => choose(p.id)}>
                  Pagar {p.name.replace("Plano ", "plano ")}
                </Button>
              </div>
            ))}
          </div>

          {plan && (
            <section id="pagamento" className="shadow-soft mt-8 rounded-2xl border border-border bg-card p-6">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Passo {step === 2 ? "1" : "2"} de 2
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {plan.name} · {plan.price} MT
              </h2>

              {step === 2 && (
                <>
                  <p className="text-muted-foreground mt-2 text-sm">
                    Escolha o método, envie {plan.price} MT para o número indicado e depois confirme.
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`min-w-0 rounded-2xl border-2 p-4 text-left sm:p-5 ${
                          method === m.id ? "border-primary bg-secondary/50" : "border-border"
                        }`}
                      >
                        <p className="text-lg font-bold">{m.name}</p>
                        <p className="mt-1 text-2xl font-extrabold break-words">{m.number}</p>
                        {m.holder && <p className="text-muted-foreground mt-1 text-sm">Nome: {m.holder}</p>}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" className="flex-1" onClick={() => copy(pay.number)}>
                      <Copy className="h-4 w-4" /> Copiar número {pay.name}
                    </Button>
                    <Button size="lg" className="shadow-brand flex-1" onClick={() => setStep(3)}>
                      <CheckCircle2 className="h-4 w-4" /> Já fiz o pagamento
                    </Button>
                  </div>
                </>
              )}

              {step === 3 && (
                <form onSubmit={onSubmit} className="mt-4 space-y-4">
                  <p className="text-muted-foreground text-sm">
                    Pagamento via <strong>{pay.name}</strong> ({pay.number}). Preencha os dados e cole o comprovativo.
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Nome de quem pagou</Label>
                    <Input id="full_name" name="full_name" required placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Número usado no pagamento</Label>
                    <Input id="phone" name="phone" required placeholder="84 000 0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="proof">Comprovativo da transacção</Label>
                    <Textarea
                      id="proof"
                      name="proof"
                      required
                      rows={3}
                      placeholder="Cole aqui a mensagem de confirmação ou o código da transacção"
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={busy}>
                      Voltar
                    </Button>
                    <Button type="submit" size="lg" className="shadow-brand flex-1" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar comprovativo
                    </Button>
                  </div>
                </form>
              )}
            </section>
          )}
        </>
      )}

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
