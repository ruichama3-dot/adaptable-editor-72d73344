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
import { Logo } from "@/components/Logo";
import {
  Plus,
  Trash2,
  FileText,
  Download,
  Clock,
  Sparkles,
  BookOpen,
  BookOpenCheck,
  GraduationCap,
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
    <div className="min-h-screen bg-[#f5f8f6] pb-28 text-[#17251d]">
      <header className="sticky top-0 z-30 border-b border-[#e4ece6] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/painel" aria-label="RuJe IA — Início" className="shrink-0"><Logo /></Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-right sm:block"><span className="block text-sm font-semibold">Olá, {firstName}</span><span className="block text-xs text-[#718078]">Área do estudante</span></span>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-[#dce9df] bg-[#edf7ef] text-sm font-bold text-[#16834a]">{firstName.slice(0, 1).toUpperCase()}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col gap-4 rounded-3xl border border-[#dcebe0] bg-gradient-to-br from-white via-white to-[#eaf7ee] p-5 shadow-[0_8px_28px_rgba(22,101,52,0.06)] sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0"><p className="text-sm font-semibold text-[#16834a]">O teu espaço académico</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#17251d] sm:text-3xl">Olá, {firstName} 👋</h1><p className="mt-2 text-sm text-[#66766c] sm:text-base">Organiza os teus estudos e continua a construir o teu futuro.</p></div>
          <Button asChild variant="brand" size="lg" className="h-12 w-full shrink-0 rounded-xl px-5 shadow-sm sm:w-auto"><Link to="/novo-trabalho"><Plus className="h-5 w-5" /> Criar novo trabalho</Link></Button>
        </section>

        <section className="mt-6">
          <div className="mb-3"><h2 className="text-lg font-bold text-[#1b2b21]">Acesso rápido</h2><p className="mt-1 text-sm text-[#718078]">Encontra rapidamente aquilo de que precisas.</p></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link to="/novo-trabalho" className="rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9bcbaa] hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><FileText className="h-5 w-5" /></span><span className="mt-3 block text-sm font-bold text-[#203128]">Criar trabalho</span><span className="mt-1 block text-xs text-[#718078]">Gerar com IA</span></Link>
            <Link to="/exames" className="rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9bcbaa] hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><BookOpenCheck className="h-5 w-5" /></span><span className="mt-3 block text-sm font-bold text-[#203128]">Comprar exames</span><span className="mt-1 block text-xs text-[#718078]">Exames e simulados</span></Link>
            <Link to="/planos" className="rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9bcbaa] hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><CreditCard className="h-5 w-5" /></span><span className="mt-3 block text-sm font-bold text-[#203128]">Planos</span><span className="mt-1 block text-xs text-[#718078]">Ver opções de acesso</span></Link>
            <Link to="/amostra/$id" params={{ id: referenceSample.id }} className="rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9bcbaa] hover:shadow-md"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><Eye className="h-5 w-5" /></span><span className="mt-3 block text-sm font-bold text-[#203128]">Ver amostra</span><span className="mt-1 block text-xs text-[#718078]">Conhecer um exemplo</span></Link>
          </div>
          {isAdmin && <Link to="/admin" className="mt-3 flex items-center justify-between rounded-xl border border-[#cfe5d5] bg-[#eff9f1] px-4 py-3 text-sm font-semibold text-[#167543]"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Painel de administração</span><ArrowRight className="h-4 w-4" /></Link>}
        </section>

        {pending && !isAdmin && <section className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-semibold">Pagamento a aguardar aprovação</p><p className="mt-1 text-sm text-amber-900">{pending.plan} · {pending.amount} MT via {pending.method}. O plano será activado após a verificação do comprovativo.</p></div></section>}

        <section className="mt-5 rounded-2xl border border-[#dcebe0] bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div className="flex min-w-0 items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]">{isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Crown className="h-5 w-5" />}</span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-[#718078]">O teu acesso</p><p className="mt-1 text-sm font-semibold leading-6 text-[#203128]">{planLabel}</p></div></div>
          {!isAdmin && <Button asChild variant="brand" className="mt-4 w-full rounded-xl sm:mt-0 sm:w-auto"><Link to="/planos">{sub ? "Renovar plano" : "Ver planos"}<ArrowRight className="h-4 w-4" /></Link></Button>}
          {isAdmin && <Button asChild variant="glass" className="mt-4 w-full sm:mt-0 sm:w-auto"><Link to="/admin"><ShieldCheck className="h-4 w-4" /> Administração</Link></Button>}
        </section>

        <section className="mt-5 rounded-2xl border border-[#e1ebe4] bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4"><div><p className="font-bold text-[#203128]">Instalar a RuJe IA no telemóvel</p><p className="mt-1 text-sm text-[#718078]">Acede à plataforma directamente pelo ecrã principal.</p></div><InstallPwaButton variant="glass" className="mt-3 w-full sm:mt-0 sm:w-auto" /></section>

        <section className="mt-7"><div className="mb-3"><h2 className="text-lg font-bold text-[#1b2b21]">Resumo da actividade</h2><p className="mt-1 text-sm text-[#718078]">Acompanha o teu progresso na plataforma.</p></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{stats.map((s) => <div key={s.label} className="rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><s.icon className="h-5 w-5" /></span><span className="text-sm text-[#718078]">{s.label}</span></div><p className="mt-3 text-2xl font-extrabold tabular-nums text-[#203128]">{s.value}</p></div>)}</div></section>

        {samples.length > 0 && <section className="mt-9"><div className="mb-3"><h2 className="text-lg font-bold text-[#1b2b21]">Trabalhos de amostra</h2><p className="mt-1 text-sm text-[#718078]">Consulta um exemplo e usa-o como referência.</p></div><div className="grid gap-3 sm:grid-cols-2">{samples.map((s) => <article key={s.id} className="rounded-2xl border border-[#e1ebe4] bg-white p-5 shadow-sm"><span className="inline-flex rounded-full bg-[#e8f6ec] px-3 py-1 text-[11px] font-bold tracking-wide text-[#16834a]">AMOSTRA</span><h3 className="mt-3 font-bold text-[#203128]">{s.title}</h3><p className="mt-1 text-sm text-[#718078]">{s.work_type} · {s.work_mode === "grupo" ? "Trabalho em grupo" : "Individual"}{s.institution ? ` · ${s.institution}` : ""}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button asChild variant="glass" className="w-full sm:w-auto"><Link to="/amostra/$id" params={{ id: s.id }}><Eye className="h-4 w-4" /> Ver trabalho</Link></Button><Button asChild variant="brand" className="w-full sm:w-auto"><Link to="/novo-trabalho" search={{ amostra: s.id }}><Copy className="h-4 w-4" /> Usar como modelo</Link></Button></div></article>)}</div></section>}

        <section className="mt-9"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold text-[#1b2b21]">Os meus trabalhos</h2><p className="mt-1 text-sm text-[#718078]">Abre, consulta ou organiza os trabalhos que já criaste.</p></div>{works.length > 0 && (selecting ? <div className="flex gap-2"><Button variant="glass" onClick={() => { setSelecting(false); setSelected([]); }}><X className="h-4 w-4" /> Cancelar</Button><Button variant="danger" onClick={deleteSelected} disabled={selected.length === 0}><Trash2 className="h-4 w-4" /> Eliminar ({selected.length})</Button></div> : <Button variant="glass" onClick={() => setSelecting(true)}><Trash2 className="h-4 w-4" /> Organizar</Button>)}</div>
          {selecting && <p className="mb-3 text-sm text-[#718078]">Selecciona os trabalhos que pretendes eliminar.</p>}
          {isLoading ? <div className="rounded-2xl border border-[#e1ebe4] bg-white p-8 text-center text-sm text-[#718078]">A carregar os teus trabalhos…</div> : works.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cbdccf] bg-white px-5 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f6ec] text-[#16834a]"><FileText className="h-6 w-6" /></span><p className="mt-3 font-semibold text-[#203128]">Ainda não tens trabalhos</p><p className="mt-1 text-sm text-[#718078]">Quando criares um trabalho, ele aparecerá aqui.</p><Button asChild variant="brand" className="mt-4"><Link to="/novo-trabalho"><Plus className="h-4 w-4" /> Criar primeiro trabalho</Link></Button></div> : <div className="grid gap-3">{selecting ? works.map((w) => { const on = selected.includes(w.id); return <label key={w.id} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm", on ? "border-red-300 bg-red-50" : "border-[#e1ebe4]")}><input type="checkbox" checked={on} onChange={() => toggle(w.id)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--destructive)]" /><span className="min-w-0"><span className="block font-semibold text-[#203128]">{w.title}</span><span className="mt-1 block text-sm text-[#718078]">{w.work_type} · {new Date(w.created_at).toLocaleDateString("pt-PT")}</span></span></label>; }) : works.map((w) => <Link key={w.id} to="/trabalho/$id" params={{ id: w.id }} className="flex flex-col gap-3 rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:border-[#9bcbaa] hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"><span className="min-w-0"><span className="block break-words font-bold text-[#203128]">{w.title}</span><span className="mt-1 block break-words text-sm text-[#718078]">{w.work_type} · {w.work_mode === "grupo" ? "Grupo" : "Individual"} · {w.theme}</span><span className="mt-1 block text-xs text-[#89968e]">Criado: {new Date(w.created_at).toLocaleDateString("pt-PT")} · Actualizado: {new Date(w.updated_at).toLocaleDateString("pt-PT")} · {w.download_count} downloads</span></span><span className={cn(buttonVariants({ variant: "brand", size: "sm" }), "w-full shrink-0 sm:w-auto")}>Abrir trabalho <ArrowRight className="h-4 w-4" /></span></Link>)}</div>}
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[#e1ebe4] bg-white p-5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><Users className="h-5 w-5" /></span><h2 className="mt-3 font-bold text-[#203128]">Comunidade WhatsApp</h2><p className="mt-1 text-sm text-[#718078]">Partilha ideias, conversa com outros estudantes e acompanha novidades.</p><Button asChild variant="brand" className="mt-4 w-full sm:w-auto"><a href="https://chat.whatsapp.com/CU2WmZIWDDvJURM2eqOtKT" target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /> Entrar na comunidade</a></Button></div><div className="rounded-2xl border border-[#e1ebe4] bg-white p-5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><Sparkles className="h-5 w-5" /></span><h2 className="mt-3 font-bold text-[#203128]">Mais ferramentas a caminho</h2><p className="mt-1 text-sm text-[#718078]">A RuJe IA continua a evoluir para apoiar cada etapa da tua aprendizagem.</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#39734e]"><span className="rounded-full bg-[#edf7ef] px-3 py-1.5">Resumos</span><span className="rounded-full bg-[#edf7ef] px-3 py-1.5">Citações</span><span className="rounded-full bg-[#edf7ef] px-3 py-1.5">Apresentações</span></div></div></section>
      </main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dce8df] bg-white/90 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 shadow-[0_-8px_28px_rgba(20,60,35,0.08)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
          <Link to="/painel" className="flex flex-col items-center gap-1 rounded-xl bg-[#eaf7ee] py-2 text-[#16834a]"><span className="grid h-6 place-items-center"><BookOpen className="h-5 w-5" /></span><span className="text-[11px] font-semibold">Início</span></Link>
          <Link to="/novo-trabalho" className="flex flex-col items-center gap-1 rounded-xl py-2 text-[#64746a] transition hover:bg-[#f1f7f2] hover:text-[#16834a]"><span className="grid h-6 place-items-center"><Plus className="h-5 w-5" /></span><span className="text-[11px] font-medium">Criar</span></Link>
          <Link to="/exames" className="flex flex-col items-center gap-1 rounded-xl py-2 text-[#64746a] transition hover:bg-[#f1f7f2] hover:text-[#16834a]"><span className="grid h-6 place-items-center"><GraduationCap className="h-5 w-5" /></span><span className="text-[11px] font-medium">Exames</span></Link>
          <Link to="/planos" className="flex flex-col items-center gap-1 rounded-xl py-2 text-[#64746a] transition hover:bg-[#f1f7f2] hover:text-[#16834a]"><span className="grid h-6 place-items-center"><CreditCard className="h-5 w-5" /></span><span className="text-[11px] font-medium">Planos</span></Link>
        </div>
      </nav>
    </div>
  );
}
