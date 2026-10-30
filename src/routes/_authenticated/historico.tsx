import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, CreditCard, FileText, GraduationCap, Plus, Search, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de trabalhos | RuJe IA" },
      { name: "description", content: "Consulte e continue os seus trabalhos académicos na RuJe IA." },
    ],
  }),
  component: Historico,
});

function Historico() {
  const { user } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("todos");

  const { data: works = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["works", user.id],
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

  const filteredWorks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const now = Date.now();
    return works.filter((work) => {
      const matchesText = !term || [work.title, work.theme, work.work_type]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(term));
      const age = now - new Date(work.updated_at ?? work.created_at).getTime();
      const matchesPeriod = period === "todos" ||
        (period === "30" && age <= 30 * 86400000) ||
        (period === "7" && age <= 7 * 86400000);
      return matchesText && matchesPeriod;
    });
  }, [works, search, period]);

  return (
    <div className="min-h-screen bg-[#f5f8f6] pb-28 text-[#17251d]">
      <main className="mx-auto min-h-[calc(100vh-80px)] max-w-6xl px-4 pb-8 pt-7 sm:px-6 sm:pt-10">
        <Link to="/painel" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#718078] transition hover:text-[#16834a]">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <section className="overflow-hidden rounded-3xl border border-[#dcebe0] bg-gradient-to-br from-white via-white to-[#eaf7ee] p-5 shadow-[0_8px_28px_rgba(22,101,52,0.06)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#d7eadc] bg-white/80 px-3 py-1 text-xs font-semibold text-[#16834a]">
                <Clock3 className="h-3.5 w-3.5" /> Biblioteca pessoal
              </span>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-[#17251d] sm:text-3xl">Histórico de trabalhos</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#66766c] sm:text-base">
                Todos os teus trabalhos num só lugar. Pesquisa, acompanha as últimas alterações e retoma quando quiseres.
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl">
              <p className="text-xs font-medium text-[#718078]">Trabalhos guardados</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#16834a]">{works.length}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#829087]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Pesquisar por título, tema ou tipo..." aria-label="Pesquisar trabalhos"
                className="h-11 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfdfb] pl-10 pr-3 text-sm text-[#203128] outline-none transition placeholder:text-[#9aa69e] focus:border-[#8fc5a0] focus:ring-2 focus:ring-[#16834a]/10" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#dfe9e2] bg-[#fbfdfb] px-3">
              <SlidersHorizontal className="h-4 w-4 text-[#718078]" />
              <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filtrar por período"
                className="h-11 min-w-32 bg-transparent text-sm text-[#405047] outline-none">
                <option value="todos">Todo o período</option>
                <option value="30">Últimos 30 dias</option>
                <option value="7">Últimos 7 dias</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#829087]">
            <span>{filteredWorks.length} {filteredWorks.length === 1 ? "resultado" : "resultados"}</span>
            {(search || period !== "todos") && <button onClick={() => { setSearch(""); setPeriod("todos"); }} className="font-semibold text-[#16834a] hover:underline">Limpar filtros</button>}
          </div>
        </section>

        <section className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border border-[#e1ebe4] bg-white p-10 text-center text-sm text-[#718078]">A carregar o teu histórico…</div>
          ) : isError ? (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
              <p className="font-semibold text-[#203128]">Não foi possível carregar o histórico.</p>
              <p className="mt-1 text-sm text-[#718078]">Verifica a ligação e tenta novamente.</p>
              <Button variant="glass" className="mt-4" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cbdccf] bg-white px-5 py-12 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f6ec] text-[#16834a]"><FileText className="h-6 w-6" /></span>
              <h2 className="mt-4 font-bold text-[#203128]">{works.length ? "Nenhum trabalho encontrado" : "O teu histórico começa aqui"}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#718078]">{works.length ? "Experimenta alterar a pesquisa ou os filtros." : "Quando criares o teu primeiro trabalho, ele ficará guardado nesta página para poderes voltar a consultá-lo."}</p>
              {!works.length && <Button asChild variant="brand" className="mt-5"><Link to="/novo-trabalho">Criar novo trabalho <ArrowRight className="h-4 w-4" /></Link></Button>}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredWorks.map((work) => (
                <article key={work.id} className="group flex flex-col gap-4 rounded-2xl border border-[#e1ebe4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9bcbaa] hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f6ec] text-[#16834a]"><FileText className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h2 className="break-words font-bold text-[#203128]">{work.title}</h2>
                      <p className="mt-1 break-words text-sm text-[#718078]">{work.work_type} · {work.work_mode === "grupo" ? "Trabalho em grupo" : "Individual"}{work.theme ? ` · ${work.theme}` : ""}</p>
                      <p className="mt-2 text-xs text-[#89968e]">Última actualização: {new Date(work.updated_at ?? work.created_at).toLocaleDateString("pt-PT")} · {work.download_count ?? 0} downloads</p>
                    </div>
                  </div>
                  <Button asChild variant="brand" className="w-full shrink-0 sm:w-auto"><Link to="/trabalho/$id" params={{ id: work.id }}>Abrir trabalho <ArrowRight className="h-4 w-4" /></Link></Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-[rgba(255,255,255,0.76)] px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 shadow-[0_-10px_36px_rgba(20,60,35,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/65">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          <Link to="/painel" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[#64746a] transition hover:bg-white/70 hover:text-[#16834a]"><span className="grid h-6 place-items-center"><BookOpen className="h-5 w-5" /></span><span className="text-[10px] font-medium">Início</span></Link>
          <Link to="/novo-trabalho" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[#64746a] transition hover:bg-white/70 hover:text-[#16834a]"><span className="grid h-6 place-items-center"><Plus className="h-5 w-5" /></span><span className="text-[10px] font-medium">Criar</span></Link>
          <Link to="/exames" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[#64746a] transition hover:bg-white/70 hover:text-[#16834a]"><span className="grid h-6 place-items-center"><GraduationCap className="h-5 w-5" /></span><span className="text-[10px] font-medium">Exames</span></Link>
          <Link to="/historico" className="flex flex-col items-center gap-1 rounded-2xl bg-[#eaf7ee]/90 py-2 text-[#16834a] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"><span className="grid h-6 place-items-center"><Clock3 className="h-5 w-5" /></span><span className="text-[10px] font-semibold">Histórico</span></Link>
          <Link to="/planos" className="flex flex-col items-center gap-1 rounded-2xl py-2 text-[#64746a] transition hover:bg-white/70 hover:text-[#16834a]"><span className="grid h-6 place-items-center"><CreditCard className="h-5 w-5" /></span><span className="text-[10px] font-medium">Planos</span></Link>
        </div>
      </nav>
    </div>
  );
}
