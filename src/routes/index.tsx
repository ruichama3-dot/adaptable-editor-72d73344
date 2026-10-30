import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import {
  ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, FileCheck2, FileText,
  GraduationCap, Headphones, MessageCircle, ShieldCheck, Sparkles, Wand2,
  Contact, Clock3, Layers3, Users,
} from "lucide-react";

const SUPPORT_NUMBER = "258847296041";
const SUPPORT_URL = "https://wa.me/" + SUPPORT_NUMBER + "?text=" + encodeURIComponent("Olá! Gostaria de obter informações sobre a RuJe IA.");

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RuJe IA 🇲🇿 — Inteligência artificial para estudar e crescer" },
      { name: "description", content: "Crie trabalhos académicos com IA, prepare-se com exames e aulas de estudo e produza currículos profissionais em PDF. Plataforma moçambicana." },
      { property: "og:title", content: "RuJe IA 🇲🇿 — Estudar, preparar e crescer" },
      { property: "og:description", content: "Trabalhos académicos, exames e currículos profissionais numa só plataforma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const services = [
  { icon: Wand2, tag: "Para estudantes", title: "Trabalhos académicos com IA", text: "Cria monografias, TCC, relatórios, seminários e artigos com uma estrutura organizada. Personaliza o conteúdo e prepara o documento para revisão.", points: ["Estrutura académica organizada", "Apoio com citações e referências", "Editor e exportação de documentos"], action: "Explorar criação de trabalhos", to: "/auth" as const, price: "Planos a partir de 30 MT" },
  { icon: BookOpenCheck, tag: "Preparação para exames", title: "Comprar exames e estudar com IA", text: "Acede ao pacote de exames da 12.ª classe disponível na plataforma e utiliza as aulas de preparação associadas para rever conteúdos e compreender as respostas.", points: ["Pacote de exames por disciplina", "Consulta dos documentos disponíveis", "Aulas de preparação para estudar"], action: "Ver pacote de exames", to: "/auth" as const, price: "125 MT · pagamento único" },
  { icon: Contact, tag: "Para oportunidades profissionais", title: "Criação de currículo profissional", text: "Responde a perguntas simples sobre a tua formação, experiência e competências. A plataforma organiza os teus dados num currículo com apresentação profissional.", points: ["Questionário simples e orientado", "Fotografia profissional opcional", "Documento final em PDF"], action: "Criar currículo", to: "/auth" as const, price: "125 MT · pagamento único" },
];

const steps = [
  { n: "01", title: "Cria a tua conta", text: "Regista-te gratuitamente com os teus dados e entra na tua área pessoal." },
  { n: "02", title: "Escolhe o serviço", text: "Indica se pretendes criar um trabalho, comprar exames ou preparar um currículo." },
  { n: "03", title: "Segue as instruções", text: "Preenche os dados necessários, escolhe o acesso ou confirma o pagamento do serviço." },
  { n: "04", title: "Acede ao resultado", text: "Utiliza as ferramentas disponíveis e consulta ou descarrega os teus documentos." },
];

const faqs = [
  { q: "A RuJe IA é apenas para estudantes universitários?", a: "Não. A plataforma disponibiliza ferramentas para diferentes necessidades: trabalhos escolares e académicos, preparação para exames e criação de currículos profissionais." },
  { q: "Quanto custa utilizar a plataforma?", a: "Os planos de criação de trabalhos começam em 30 MT. O pacote de exames custa 125 MT e a criação de currículo profissional custa 125 MT, cada um com pagamento único." },
  { q: "Como recebo o meu currículo?", a: "Depois da confirmação do pagamento, preenches o questionário e podes gerar e descarregar o teu currículo em PDF." },
  { q: "Como posso pedir ajuda?", a: "Podes contactar o suporte da RuJe IA pelo WhatsApp através do número +258 84 729 6041." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/painel", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="RuJe IA — página inicial"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground lg:flex" aria-label="Navegação principal">
            <a href="#servicos" className="transition hover:text-primary">Serviços</a>
            <a href="#como-funciona" className="transition hover:text-primary">Como funciona</a>
            <a href="#precos" className="transition hover:text-primary">Preços</a>
            <a href="#perguntas" className="transition hover:text-primary">Perguntas frequentes</a>
            <a href="#contacto" className="transition hover:text-primary">Suporte</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Entrar</Link></Button>
            <Button asChild size="sm"><Link to="/auth" search={{ modo: "registo" }}>Criar conta <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(34,197,94,0.14),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(22,163,74,0.08),transparent_45%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" /> Plataforma de inteligência artificial moçambicana</span>
              <h1 className="mt-6 max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-6xl">As tuas ideias merecem <span className="text-brand-gradient">ir mais longe.</span></h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">A RuJe IA reúne ferramentas inteligentes para apoiar os teus estudos, a preparação para exames e a tua apresentação profissional — tudo num só lugar, com acesso simples e preços em meticais.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 shadow-brand"><Link to="/auth" search={{ modo: "registo" }}>Começar agora <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="h-12"><a href="#servicos">Conhecer os serviços <ChevronDown className="ml-2 h-4 w-4" /></a></Button>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Registo simples</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Preços em MT</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> Suporte por WhatsApp</span>
              </div>
              <div className="mt-8"><InstallPwaButton className="shadow-soft" /></div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-primary/10 blur-2xl" />
              <div className="relative rounded-[2rem] border border-primary/15 bg-card/90 p-4 shadow-[0_24px_80px_rgba(16,80,40,0.13)] backdrop-blur-xl sm:p-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-extrabold">RuJe IA</p><p className="text-xs text-muted-foreground">O teu espaço de aprendizagem</p></div></div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">🇲🇿 Moçambique</span>
                </div>
                <p className="mt-5 text-sm font-semibold">O que pretendes fazer hoje?</p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">Criar trabalho académico</p><p className="text-xs text-muted-foreground">Monografia, TCC, relatório e mais</p></div><ArrowRight className="h-4 w-4 text-primary" /></div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpenCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">Comprar exames</p><p className="text-xs text-muted-foreground">Exames e preparação com IA</p></div><ArrowRight className="h-4 w-4 text-primary" /></div>
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Contact className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="font-bold">Criar currículo profissional</p><p className="text-xs text-muted-foreground">Organizado e pronto em PDF</p></div><ArrowRight className="h-4 w-4 text-primary" /></div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3"><span className="text-xs text-muted-foreground">Uma plataforma. Diferentes soluções.</span><span className="text-xs font-extrabold text-primary">RuJe IA 🇲🇿</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-7 sm:grid-cols-3 sm:px-6">
            <div className="flex items-center gap-3"><GraduationCap className="h-6 w-6 text-primary" /><div><p className="font-bold">Apoio académico</p><p className="text-xs text-muted-foreground">Ferramentas para estudar e produzir</p></div></div>
            <div className="flex items-center gap-3"><FileCheck2 className="h-6 w-6 text-primary" /><div><p className="font-bold">Documentos profissionais</p><p className="text-xs text-muted-foreground">Conteúdo organizado e exportável</p></div></div>
            <div className="flex items-center gap-3"><Headphones className="h-6 w-6 text-primary" /><div><p className="font-bold">Apoio ao utilizador</p><p className="text-xs text-muted-foreground">Contacto directo por WhatsApp</p></div></div>
          </div>
        </section>

        <section id="servicos" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center"><span className="text-xs font-extrabold tracking-[0.18em] text-primary uppercase">O que podes fazer</span><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Três soluções. Um só espaço.</h2><p className="mt-4 leading-7 text-muted-foreground">Escolhe o serviço que corresponde ao teu objectivo e começa com orientação em cada etapa.</p></div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {services.map((service) => <article key={service.title} className="group flex flex-col rounded-3xl border border-border bg-card p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
              <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">{service.tag}</span><service.icon className="h-6 w-6 text-primary" /></div>
              <h3 className="mt-5 text-xl font-extrabold">{service.title}</h3><p className="mt-3 min-h-[88px] text-sm leading-6 text-muted-foreground">{service.text}</p>
              <ul className="mt-5 space-y-3">{service.points.map(point => <li key={point} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{point}</span></li>)}</ul>
              <div className="mt-auto pt-7"><p className="mb-3 text-sm font-extrabold text-primary">{service.price}</p><Button asChild variant="outline" className="w-full"><Link to={service.to} search={{ modo: "registo" }}>{service.action} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
            </article>)}
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 bg-[#103d28] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-6">
            <div className="max-w-2xl"><span className="text-xs font-extrabold tracking-[0.18em] text-green-300 uppercase">Simples e directo</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Começa em poucos passos.</h2><p className="mt-4 leading-7 text-white/70">Não precisas de conhecer todas as ferramentas. A plataforma orienta-te para o serviço que procuras.</p></div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{steps.map(step => <div key={step.n} className="rounded-2xl border border-white/15 bg-white/[0.06] p-5"><p className="text-3xl font-black text-green-300">{step.n}</p><h3 className="mt-4 font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-white/65">{step.text}</p></div>)}</div>
          </div>
        </section>

        <section id="precos" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center"><span className="text-xs font-extrabold tracking-[0.18em] text-primary uppercase">Preços transparentes</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Escolhe o que precisas.</h2><p className="mt-4 leading-7 text-muted-foreground">Valores em meticais. Os serviços de exames e currículo são compras únicas; os planos académicos têm duração definida.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Acesso de 1 dia", price: "30 MT", detail: "Até 2 trabalhos por dia", flag: "Para começar" },
              { name: "Plano semanal", price: "150 MT", detail: "7 dias · até 2 trabalhos por dia", flag: "7 dias" },
              { name: "Plano de 14 dias", price: "250 MT", detail: "14 dias · até 4 trabalhos por dia", flag: "14 dias" },
              { name: "Plano de 30 dias", price: "400 MT", detail: "30 dias · até 10 trabalhos por dia", flag: "30 dias" },
            ].map(plan => <div key={plan.name} className="rounded-2xl border border-border bg-card p-5 shadow-soft"><span className="text-xs font-bold text-primary">{plan.flag}</span><h3 className="mt-3 font-bold">{plan.name}</h3><p className="mt-2 text-3xl font-black">{plan.price}</p><p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{plan.detail}</p><Button asChild variant="outline" className="mt-5 w-full"><Link to="/auth" search={{ modo: "registo" }}>Criar conta</Link></Button></div>)}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div><p className="font-bold">Pacote de exames</p><p className="mt-1 text-sm text-muted-foreground">Acesso aos exames disponíveis e aulas de preparação.</p></div><p className="shrink-0 text-xl font-black text-primary">125 MT</p></div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div><p className="font-bold">Currículo profissional</p><p className="mt-1 text-sm text-muted-foreground">Questionário orientado e currículo final em PDF.</p></div><p className="shrink-0 text-xl font-black text-primary">125 MT</p></div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">Os serviços são desbloqueados após confirmação do pagamento. Consulta as condições e detalhes na tua conta.</p>
        </section>

        <section className="border-y border-border bg-muted/25 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div><span className="text-xs font-extrabold tracking-[0.18em] text-primary uppercase">Porque RuJe IA</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Mais clareza para avançar.</h2><p className="mt-4 leading-7 text-muted-foreground">A RuJe IA foi pensada para reunir ferramentas úteis num ambiente simples, com valores em meticais e caminhos claros para cada necessidade.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5"><Layers3 className="h-6 w-6 text-primary" /><h3 className="mt-3 font-bold">Tudo organizado</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Serviços separados para encontrares rapidamente o que procuras.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><Clock3 className="h-6 w-6 text-primary" /><h3 className="mt-3 font-bold">Poupa tempo</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Processos guiados para começares sem complicações.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><ShieldCheck className="h-6 w-6 text-primary" /><h3 className="mt-3 font-bold">Conta pessoal</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Acede aos teus serviços a partir da tua conta.</p></div>
              <div className="rounded-2xl border border-border bg-card p-5"><Users className="h-6 w-6 text-primary" /><h3 className="mt-3 font-bold">Comunidade</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Junta-te à comunidade e acompanha novidades.</p></div>
            </div>
          </div>
        </section>

        <section id="perguntas" className="scroll-mt-24 mx-auto max-w-4xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="text-center"><span className="text-xs font-extrabold tracking-[0.18em] text-primary uppercase">Ajuda e informação</span><h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Perguntas frequentes</h2></div>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card px-5">{faqs.map(faq => <details key={faq.q} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 text-primary transition group-open:rotate-180" /></summary><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{faq.a}</p></details>)}</div>
        </section>

        <section id="contacto" className="scroll-mt-24 px-5 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#145b36] to-[#0d3924] p-7 text-white shadow-xl sm:p-10">
            <div className="grid gap-7 sm:grid-cols-[1fr_auto] sm:items-center">
              <div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-green-200"><Headphones className="h-4 w-4" /> Estamos disponíveis para ajudar</span><h2 className="mt-4 text-3xl font-extrabold">Precisas de apoio?</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/75">Fala com a equipa da RuJe IA para esclarecer dúvidas sobre a plataforma, pagamentos, exames ou criação de currículo.</p><p className="mt-4 text-lg font-extrabold">+258 84 729 6041</p><p className="mt-1 text-xs text-white/65">Suporte por WhatsApp</p></div>
              <Button asChild size="lg" className="h-12 bg-white text-[#145b36] hover:bg-green-50"><a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-5 w-5" /> Contactar suporte</a></Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div><Logo /><p className="mt-2 text-xs text-muted-foreground">Inteligência artificial ao serviço da aprendizagem e do desenvolvimento profissional.</p></div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><a href="#servicos" className="hover:text-primary">Serviços</a><a href="#precos" className="hover:text-primary">Preços</a><a href="#perguntas" className="hover:text-primary">Ajuda</a><a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary">WhatsApp</a><Link to="/auth" className="hover:text-primary">Entrar</Link></div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} RuJe IA 🇲🇿. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
