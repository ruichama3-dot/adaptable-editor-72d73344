import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenCheck, ArrowRight, CheckCircle2, Contact, FileText, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/escolher-servico")({
  head: () => ({
    meta: [
      { title: "Escolhe o teu serviço | RuJe IA" },
      { name: "description", content: "Escolhe o que pretendes fazer na RuJe IA." },
    ],
  }),
  component: EscolherServico,
});

const choices = [
  {
    title: "Criar trabalho académico",
    description: "Produz trabalhos escolares e académicos com apoio de inteligência artificial, incluindo monografias, TCC, relatórios, seminários e artigos.",
    detail: "Planos a partir de 30 MT",
    icon: FileText,
    to: "/novo-trabalho" as const,
    label: "Começar um trabalho",
  },
  {
    title: "Comprar exames",
    description: "Consulta o pacote de exames da 12.ª classe disponível na plataforma e utiliza os materiais de preparação e estudo com IA.",
    detail: "125 MT · pagamento único",
    icon: BookOpenCheck,
    to: "/exames" as const,
    label: "Ver pacote de exames",
  },
  {
    title: "Criar currículo profissional",
    description: "Responde a um questionário orientado sobre a tua formação, experiência e competências e gera um currículo profissional em PDF.",
    detail: "125 MT · pagamento único",
    icon: Contact,
    to: "/curriculo" as const,
    label: "Criar currículo",
  },
];

function EscolherServico() {
  return (
    <main className="mx-auto min-h-[calc(100vh-76px)] max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Bem-vindo à RuJe IA</span>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">O que pretendes fazer hoje?</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Escolhe uma das opções abaixo. Vamos encaminhar-te directamente para o serviço e explicar os próximos passos.</p>
      </section>

      <section className="mt-9 grid gap-5 lg:grid-cols-3">
        {choices.map((choice, index) => (
          <article key={choice.title} className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><choice.icon className="h-6 w-6" /></span>
              <span className="text-xs font-extrabold tracking-widest text-muted-foreground">0{index + 1}</span>
            </div>
            <h2 className="mt-5 text-xl font-extrabold">{choice.title}</h2>
            <p className="mt-3 min-h-[112px] text-sm leading-6 text-muted-foreground">{choice.description}</p>
            <div className="mt-5 flex items-center gap-2 text-sm font-extrabold text-primary"><CheckCircle2 className="h-4 w-4" /> {choice.detail}</div>
            <Button asChild className="mt-6 h-11 w-full"><Link to={choice.to}>{choice.label} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-5 text-center sm:flex-row sm:text-left">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-5 w-5" /></span><div><p className="font-bold">Ainda não decidiste?</p><p className="text-sm text-muted-foreground">Podes explorar o painel e escolher mais tarde.</p></div></div>
        <Button asChild variant="outline"><Link to="/painel">Ir para o painel</Link></Button>
      </section>
    </main>
  );
}
