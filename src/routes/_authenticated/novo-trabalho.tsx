import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateWork } from "@/lib/works.functions";
import { getAccess } from "@/lib/access.functions";
import { referenceSample } from "@/lib/reference-sample";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2, Users, User as UserIcon, BookMarked, Image as ImageIcon, Presentation, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/novo-trabalho")({
  validateSearch: z.object({ amostra: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Criar novo trabalho | RuJe IA" },
      { name: "description", content: "Preencha os dados académicos e deixe a IA escrever o seu trabalho." },
      { property: "og:title", content: "Criar novo trabalho | RuJe IA" },
      { property: "og:description", content: "A IA escreve o seu trabalho académico completo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovoTrabalho,
});

const WORK_TYPES = [
  "Trabalho Escolar",
  "Trabalho Científico",
  "Monografia",
  "Projeto de Pesquisa",
  "Relatório",
  "Artigo Científico",
  "Seminário",
  "Revisão Bibliográfica",
  "Estudo de Caso",
  "Dissertação",
  "TCC",
];
const LEVELS = ["Ensino Médio", "Ensino Técnico", "Licenciatura", "Mestrado", "Doutoramento"];
const LANGS = ["Português", "Inglês", "Francês", "Espanhol"];
const NORMS = ["APA", "ABNT", "Vancouver"];

function Field({ id, label, ...rest }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...rest} />
    </div>
  );
}

function Sel({
  id,
  label,
  options,
  defaultValue,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: string[];
  defaultValue?: string | undefined;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Choice({
  active,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-colors ${
        active ? "border-primary bg-secondary/50" : "border-border hover:border-primary/40"
      }`}
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="text-muted-foreground mt-0.5 text-sm">{text}</p>
    </button>
  );
}

function NovoTrabalho() {
  const { user } = Route.useRouteContext();
  const { amostra } = Route.useSearch();
  const navigate = useNavigate();
  const generate = useServerFn(generateWork);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({ cover: true, index: true, citations: true, references: true });
  const [includeImages, setIncludeImages] = useState(false);
  const [outputFormat, setOutputFormat] = useState<"normal" | "powerpoint">("normal");
  const [workType, setWorkType] = useState(sample?.work_type ?? "Trabalho Escolar");
  const [mode, setMode = useState<"individual" | "grupo">("individual");
  const [refsMode, setRefsMode] = useState<"automatica" | "manual">("automatica");

  useEffect(() => {
    if (sample?.work_type && WORK_TYPES.includes(sample.work_type)) setWorkType(sample.work_type);
  }, [sample?.work_type]);

  const isPowerPoint = outputFormat === "powerpoint";
  const isExtendedForm = ["Trabalho Científico", "Monografia", "Projeto de Pesquisa", "Dissertação", "TCC"].includes(workType);
  const isArticle = ["Artigo Científico", "Revisão Bibliográfica"].includes(workType);
  const usesCoverDetails = !isPowerPoint && !isArticle;
  const showInstitutionalDetails = !isPowerPoint;

  const fetchAccess = useServerFn(getAccess);
  const { data: access, isLoading: loadingAccess } = useQuery({
    queryKey: ["my-access", user.id],
    queryFn: () => fetchAccess({ data: undefined }),
    staleTime: 60 * 1000,
  });

  const { data: sample, isLoading: loadingSample } = useQuery({
    queryKey: ["sample", amostra],
    enabled: Boolean(amostra),
    queryFn: async () => {
      const { data } = amostra === referenceSample.id
        ? { data: referenceSample }
        : await supabase.from("samples").select("*").eq("id", amostra ?? "").maybeSingle();
      if (data?.work_mode === "grupo") setMode("grupo");
      return data;
    },
  });


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    try {
      const { data: work, error } = await supabase
        .from("works")
        .insert({
          user_id: user.id,
          theme: s("theme"),
          title: s("title") || s("theme"),
          work_type: s("work_type"),
          work_mode: mode,
          group_members: mode === "grupo" ? s("group_members") : null,
          references_mode: refsMode,
          manual_references: refsMode === "manual" ? s("manual_references") : null,
          student_name: s("student_name"),
          student_number: s("student_number"),
          course: s("course"),
          class_group: s("class_group"),
          grade_year: s("grade_year"),
          institution: s("institution"),
          faculty: s("faculty"),
          department: s("department"),
          subject: s("subject"),
          teacher: s("teacher"),
          city: s("city"),
          country: s("country"),
          due_date: s("due_date") || null,
          pages: Number(f.get("pages")) || 10,
          language: s("language"),
          academic_level: s("academic_level"),
          norms: s("norms"),
          options: { ...opts, includeImages, outputFormat },
        })
        .select()
        .single();
      if (error) throw error;
      toast.info("A IA está a escrever o seu trabalho… pode demorar 1 a 3 minutos.");
      const generated = await generate({ data: { workId: work.id } });
      if (outputFormat === "powerpoint") {
        toast.success("Apresentação preparada. No ecrã seguinte, descarregue o PowerPoint.");
      } else if (includeImages && generated.imagesAdded === 0) {
        toast.info("O trabalho foi gerado, mas não foram encontradas imagens adequadas. Pode tentar novamente mais tarde.");
      } else {
        toast.success("Trabalho gerado!");
      }
      navigate({ to: "/trabalho/$id", params: { id: work.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível gerar o trabalho.");
    } finally {
      setBusy(false);
    }
  }

  if ((amostra && loadingSample) || loadingAccess) {
    return <main className="mx-auto max-w-4xl px-5 py-10 text-muted-foreground">A carregar…</main>;
  }

  if (access && !access.hasAccess) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Precisa de um plano activo</h1>
        <p className="text-muted-foreground mt-3">
          Para criar trabalhos na RuJe IA é necessário ter um plano activo. Escolha o plano que
          melhor lhe serve e envie o comprovativo do pagamento.
        </p>
        <Button asChild size="lg" className="shadow-brand mt-7">
          <Link to="/planos">Ver planos</Link>
        </Button>
      </main>
    );
  }


  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-5 sm:py-8">
      {busy && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 px-5 backdrop-blur">
          <div className="shadow-soft w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
            <Loader2 className="text-primary mx-auto h-10 w-10 animate-spin" />
            <p className="mt-5 text-lg font-extrabold">A gerar o seu trabalho…</p>
            <p className="text-muted-foreground mt-2 text-sm">
              A IA está a escrever o documento completo. Pode demorar 1 a 3 minutos — não feche esta página.
            </p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="bg-brand h-full w-1/3 animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}
      <h1 className="text-3xl font-extrabold">Criar novo trabalho</h1>
      <p className="text-muted-foreground mt-1">Quanto mais completo o formulário, melhor o resultado.</p>
      {sample && (
        <p className="mt-3 rounded-xl border border-primary bg-secondary/50 px-4 py-2.5 text-sm">
          A usar o modelo: <strong>{sample.title}</strong>. Altere os dados para o seu trabalho.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-7 space-y-6">
        {!isPowerPoint && <section className="shadow-soft rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-bold">Modalidade do trabalho</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice
              active={mode === "individual"}
              onClick={() => setMode("individual")}
              icon={UserIcon}
              title="Trabalho individual"
              text="A capa e a folha de rosto levam o seu nome e número."
            />
            <Choice
              active={mode === "grupo"}
              onClick={() => setMode("grupo")}
              icon={Users}
              title="Trabalho em grupo"
              text="A folha de rosto lista todos os elementos do grupo."
            />
          </div>
          {mode === "grupo" && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="group_members">Elementos do grupo (um por linha)</Label>
              <Textarea
                id="group_members"
                name="group_members"
                rows={5}
                placeholder={"1- Abstinência José Pedro\n2- Adélia Agostinho\n3- Ágata Remígio"}
              />
            </div>
          )}
        </section>}

        <section className="shadow-soft rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-bold">Informações académicas</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="theme">Tema do trabalho</Label>
              <Textarea
                id="theme"
                name="theme"
                required
                rows={2}
                defaultValue={sample?.theme ?? ""}
                placeholder="Ex.: Impacto das energias renováveis em Moçambique"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="title" label="Título do trabalho" defaultValue={sample?.title ?? ""} />
              <Sel id="work_type" label="Tipo de trabalho" options={WORK_TYPES} value={workType} onChange={setWorkType} />
              {usesCoverDetails && <Field id="student_name" label="Nome do estudante" />}
              {usesCoverDetails && <Field id="student_number" label="Número do estudante" />}
              {showInstitutionalDetails && <Field id="course" label="Curso" />}
              {isExtendedForm && <Field id="class_group" label="Turma" />}
              {isExtendedForm && <Field id="grade_year" label="Classe / Ano" />}
              {showInstitutionalDetails && <Field id="institution" label="Instituição de ensino" defaultValue={sample?.institution ?? ""} />}
              {isExtendedForm && <Field id="faculty" label="Faculdade" />}
              {isExtendedForm && <Field id="department" label="Departamento" />}
              {showInstitutionalDetails && <Field id="subject" label="Disciplina" />}
              {showInstitutionalDetails && <Field id="teacher" label="Nome do docente" />}
              {showInstitutionalDetails && <Field id="city" label="Cidade" defaultValue="Maputo" />}
              {showInstitutionalDetails && <Field id="country" label="País" defaultValue="Moçambique" />}
              {isExtendedForm && <Field id="due_date" label="Data de entrega" type="date" />
            </div>
          </div>
        </section>

        <section className="shadow-soft rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-bold">{isPowerPoint ? "Fontes e referências para a apresentação" : "Referências bibliográficas"}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice
              active={refsMode === "automatica"}
              onClick={() => setRefsMode("automatica")}
              icon={Wand2}
              title="Automáticas"
              text="A IA escolhe e formata as referências e as citações."
            />
            <Choice
              active={refsMode === "manual"}
              onClick={() => setRefsMode("manual")}
              icon={BookMarked}
              title="Manuais"
              text="Indica as suas referências e a IA usa apenas essas."
            />
          </div>
          {refsMode === "manual" && (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="manual_references">As suas referências (uma por linha)</Label>
              <Textarea
                id="manual_references"
                name="manual_references"
                rows={5}
                placeholder={"LUCKESI, C. C. Avaliação da Aprendizagem Escolar. São Paulo: Cortez, 2011."}
              />
            </div>
          )}
        </section>

        <section className="shadow-soft rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-bold">Formato de saída</h2>
          <p className="text-muted-foreground mt-1 text-sm">Escolha estas opções antes de gerar. Não alteram os restantes dados do formulário.</p>
          {!isPowerPoint && <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice
              active={!includeImages}
              onClick={() => setIncludeImages(false)}
              icon={FileText}
              title="Sem imagens"
              text="Documento académico apenas com texto."
            />
            <Choice
              active={includeImages}
              onClick={() => setIncludeImages(true)}
              icon={ImageIcon}
              title="Com imagens"
              text="Imagens colocadas junto da secção do desenvolvimento que ilustram."
            />
          </div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Choice
              active={outputFormat === "normal"}
              onClick={() => setOutputFormat("normal")}
              icon={FileText}
              title="Trabalho normal"
              text="Documento académico organizado segundo o modelo de referência da RuJe IA."
            />
            <Choice
              active={outputFormat === "powerpoint"}
              onClick={() => setOutputFormat("powerpoint")}
              icon={Presentation}
              title="Apresentação PowerPoint"
              text="Conteúdo organizado em diapositivos para apresentação oral."
            />
          </div>
        </section>

        <section className="shadow-soft rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-lg font-bold">{isPowerPoint ? "Opções da apresentação" : "Configurações do documento"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {!isPowerPoint && <Field id="pages" label="Quantidade de páginas" type="number" min={2} max={60} defaultValue={10} />}
            <Sel id="language" label="Idioma" options={LANGS} />
            <Sel id="academic_level" label="Nível académico" options={LEVELS} />
            {!isPowerPoint && <Sel id="norms" label="Normas académicas" options={NORMS} />}
          </div>
          {isPowerPoint ? (
            <p className="mt-4 rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm">
              A apresentação terá até 10 diapositivos, sem índice, com conteúdo resumido para exposição oral.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["cover", "Gerar capa automática"],
                ["index", "Gerar índice automático"],
                ["citations", "Inserir citações automáticas"],
                ["references", "Referências automáticas"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-sm">
                  {label}
                  <Switch
                    checked={opts[k as keyof typeof opts]}
                    onCheckedChange={(v) => setOpts((o) => ({ ...o, [k as string]: v }))}
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        <Button type="submit" size="lg" className="shadow-brand w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {busy ? "A gerar o trabalho…" : "Gerar trabalho com IA"}
        </Button>
      </form>
    </main>
  );
}
