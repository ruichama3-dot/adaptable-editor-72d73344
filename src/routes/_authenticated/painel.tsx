import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button, buttonVariants } from "@/components/ui/button";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import { referenceSample } from "@/lib/reference-sample";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  FileText,
  Download,
  Clock,
  Sparkles,
  Settings,
  BookOpen,
  BookOpenCheck,
  MessageCircle,
  Copy,
  Eye,
  Crown,
  ShieldCheck,
  ArrowRight,
  CreditCard,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | RuJe IA" },
      { name: "description", content: "Os seus trabalhos, downloads, planos e estatísticas na RuJe IA." },
      { property: "og:title", content: "Painel | RuJe IA" },
      { property: "og:description", content: "Os seus trabalhos académicos num só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { user } = Route.useRouteContext();
  const { isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function deleteSelected() {
    if (selected.length === 0) return;
    const n = selected.length;
    if (!window.confirm(`Eliminar ${n} trabalho${n > 1 ? "s" : ""} seleccionado${n > 1 ? "s" : ""}? Esta acção não pode ser anulada.`)) return;
    const { error } = await supabase.from("works").delete().eq("user_id", user.id).in("id", selected);
    if (error) {
      toast.error("Não foi possível eliminar. Tente novamente.");
      return;
    }
    setSelected([]);
    setSelecting(false);
    void queryClient.invalidateQueries({ queryKey: ["works"] });
    toast.success("Trabalho(s) eliminado(s).");
  }

  const { data: works = [], isLoading } = useQuery({
    queryKey: ["works"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("works")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const samples = [referenceSample];

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

  const { data: pending } = useQuery({
    queryKey: ["my-pending-payment"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_requests")
        .select("id, plan, amount, method, created_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const last = data?.[0];
      return last && String(last.status ?? "").toLowerCase().startsWith("pend") ? last : null;
    },
  });

  const firstName =
    (user.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ??
    user.email?.split("@")[0] ??
    "estudante";
  const downloads = works.reduce((s, w) => s + (w.download_count ?? 0), 0);

  const stats = [
    { icon: FileText, label: "Trabalhos criados", value: works.length },
    { icon: Download, label: "Downloads", value: downloads },
    {
      icon: Clock,
      label: "Último trabalho",
      value: works[0] ? new Date(works[0].updated_at).toLocaleDateString("pt-PT") : "—",
    },
  ];

  const planLabel = isAdmin
    ? "Administrador · acesso ilimitado"
    : sub
      ? `${sub.plan} · ${sub.daily_limit} trabalhos/dia até ${new Date(sub.expires_at).toLocaleDateString("pt-PT")}`
      : "Sem plano activo · escolha um plano para criar trabalhos";

  return (

    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
      {/* Cabeçalho + acção principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold capitalize sm:text-3xl">Olá, {firstName} 👋</h1>
          <p className="text-muted-foreground mt-1">Pronto para criar o próximo trabalho?</p>
        </div>
        <Button asChild variant="brand" size="lg" className="w-full sm:w-auto">
          <Link to="/novo-trabalho">
            <Plus className="h-4 w-4" /> Criar Novo Trabalho
          </Link>
        </Button>
      </div>

      {/* Acessos rápidos */}
      <nav
        aria-label="Acessos rápidos"
        className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-2.5 sm:w-fit"
      >
        <Button asChild variant="brand" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <Link to="/exames">
            <BookOpenCheck className="h-4 w-4" /> Exames e simulados
          </Link>
        </Button>
        <Button asChild variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <Link to="/planos">
            <CreditCard className="h-4 w-4" /> Planos
          </Link>
        </Button>
        <Button asChild variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
          <Link to="/amostra/$id" params={{ id: referenceSample.id }}>
            <Eye className="h-4 w-4" /> Amostra
          </Link>
        </Button>
        {isAdmin && (
          <Button asChild variant="glass" size="sm" className="w-full grow px-3 sm:w-auto sm:grow-0">
            <Link to="/admin">
              <ShieldCheck className="h-4 w-4" /> Painel admin
            </Link>
          </Button>
        )}

      </nav>

      {pending && !isAdmin && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold">Pedido enviado · a aguardar aprovação</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {pending.plan} · {pending.amount} MT via {pending.method}. Aguarde — o administrador está a verificar o
              seu comprovativo e o plano será activado assim que for aprovado.
            </p>
          </div>
        </div>
      )}

      {/* Plano actual */}
      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-secondary/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-2 font-semibold break-words">
          {isAdmin ? (
            <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Crown className="mt-1 h-4 w-4 shrink-0 text-primary" />
          )}
          {planLabel}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isAdmin && (
            <Button asChild variant="glass">
              <Link to="/admin">
                <ShieldCheck className="h-4 w-4" /> Painel admin
              </Link>
            </Button>
          )}
          {!isAdmin && (
            <Button asChild variant="brand">
              <Link to="/planos">
                {sub ? "Renovar plano" : "Ver planos"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Instalação */}
      <section className="mt-4 flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Instalar a RuJe IA no seu telemóvel</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Aceda à RuJe IA directamente pelo ícone no ecrã principal.
          </p>
        </div>
        <InstallPwaButton variant="glass" className="w-full sm:w-auto" />
      </section>

      {/* Estatísticas */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="shadow-soft rounded-2xl border border-border bg-card p-5">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="mt-2 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Amostras */}
      {samples.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Trabalhos de amostra</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Veja um trabalho completo feito na RuJe IA e crie o seu no mesmo modelo.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {samples.map((s) => (
              <div key={s.id} className="shadow-soft rounded-2xl border border-border bg-card p-5">
                <span className="bg-brand rounded-full px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
                  AMOSTRA
                </span>
                <p className="mt-3 font-semibold">{s.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {s.work_type} · {s.work_mode === "grupo" ? "Trabalho em grupo" : "Individual"}
                  {s.institution ? ` · ${s.institution}` : ""}
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button asChild variant="glass" className="w-full sm:w-auto">
                    <Link to="/amostra/$id" params={{ id: s.id }}>
                      <Eye className="h-4 w-4" /> Ver trabalho
                    </Link>
                  </Button>
                  <Button asChild variant="brand" className="w-full sm:w-auto">
                    <Link to="/novo-trabalho" search={{ amostra: s.id }}>
                      <Copy className="h-4 w-4" /> Fazer igual
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Histórico */}
      <section className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold">Histórico de trabalhos</h2>
          {works.length > 0 &&
            (selecting ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="glass" onClick={() => { setSelecting(false); setSelected([]); }} className="w-full sm:w-auto">
                  <X className="h-4 w-4" /> Cancelar
                </Button>
                <Button variant="danger" onClick={deleteSelected} disabled={selected.length === 0} className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4" /> Eliminar seleccionados ({selected.length})
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setSelecting(true)} className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4" /> Eliminar trabalhos
              </Button>
            ))}
        </div>
        {selecting && (
          <p className="text-muted-foreground mt-2 text-sm">Toque nos trabalhos que deseja eliminar.</p>
        )}
        {isLoading ? (
          <p className="text-muted-foreground mt-4 text-sm">A carregar…</p>
        ) : works.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-muted-foreground">Ainda não criou nenhum trabalho.</p>
            <Button asChild variant="brand" className="mt-4 w-full sm:w-auto">
              <Link to="/novo-trabalho">
                <Plus className="h-4 w-4" /> Criar o primeiro
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {selecting && works.map((w) => {
              const on = selected.includes(w.id);
              return (
                <label
                  key={w.id}
                  className={cn(
                    "shadow-soft flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4 sm:p-5",
                    on ? "border-destructive/60 bg-destructive/5" : "border-border",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(w.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--destructive)]"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{w.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-sm break-words">
                      {w.work_type} · {new Date(w.created_at).toLocaleDateString("pt-PT")}
                    </p>
                  </div>
                </label>
              );
            })}
            {!selecting && works.map((w) => (
              <Link
                key={w.id}
                to="/trabalho/$id"
                params={{ id: w.id }}
                className="shadow-soft group flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold break-words">{w.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm break-words">
                    {w.work_type} · {w.work_mode === "grupo" ? "Grupo" : "Individual"} · {w.theme}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Criado: {new Date(w.created_at).toLocaleDateString("pt-PT")} · Editado:{" "}
                    {new Date(w.updated_at).toLocaleDateString("pt-PT")} · {w.download_count} downloads
                  </p>
                </div>
                <span
                  className={cn(
                    buttonVariants({ variant: "brand", size: "sm" }),
                    "w-full shrink-0 sm:w-auto sm:px-5",
                  )}
                >
                  Abrir trabalho <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Comunidade */}
      <section className="mt-12">
        <h2 className="text-xl font-bold">Comunidade WhatsApp</h2>
        <div className="shadow-soft mt-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-muted-foreground text-sm">
            Converse com outros estudantes, partilhe opiniões e fique atento aos cursos com certificado.
          </p>
          <Button asChild variant="brand" className="mt-4 w-full sm:w-auto">
            <a
              href="https://chat.whatsapp.com/CU2WmZIWDDvJURM2eqOtKT"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Users className="h-4 w-4" /> Entrar na comunidade
            </a>
          </Button>
        </div>
      </section>

      {/* Outros programas */}
      <section className="mt-12">
        <h2 className="text-xl font-bold">Outros programas da RuJe IA</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "RuJe Resumos", text: "Resumos automáticos de livros e artigos. Em breve." },
            { icon: BookOpen, title: "RuJe Citações", text: "Gerador de referências APA/ABNT. Em breve." },
            { icon: Settings, title: "RuJe Apresentações", text: "Slides académicos automáticos. Em breve." },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-secondary/50 p-5">
              <p.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-semibold">{p.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
