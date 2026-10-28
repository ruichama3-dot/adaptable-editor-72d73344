import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpenCheck, CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateExam, type ExamQuestion } from "@/lib/exams.functions";

export const Route = createFileRoute("/_authenticated/exames")({
  head: () => ({ meta: [{ title: "Exames e simulados | RuJe IA" }, { name: "description", content: "Pratique com exames e simulados, respostas e correção." }] }),
  component: ExamesPage,
});

type ExamResult = { title: string; notice: string; questions: ExamQuestion[] };

function ExamesPage() {
  const generate = useServerFn(generateExam);
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("Ensino Secundário");
  const [topic, setTopic] = useState("");
  const [type, setType] = useState<"simulado" | "anterior">("simulado");
  const [questionCount, setQuestionCount] = useState("10");
  const [exam, setExam] = useState<ExamResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function createExam() {
    if (subject.trim().length < 2 || topic.trim().length < 2) {
      toast.error("Indica a disciplina e a matéria do exame.");
      return;
    }
    setLoading(true);
    setExam(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const result = await generate({ data: { subject: subject.trim(), level, topic: topic.trim(), type, questionCount: Number(questionCount) } });
      setExam(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o exame.");
    } finally {
      setLoading(false);
    }
  }

  const score = exam?.questions.reduce((sum, q, i) => sum + (answers[i] === q.correctAnswer ? 1 : 0), 0) ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary"><BookOpenCheck className="h-7 w-7" /></div>
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Exames e simulados</h1>
          <p className="mt-1 text-muted-foreground">Estuda, responde às perguntas e recebe correção com explicações.</p>
        </div>
      </div>

      {!exam && <section className="mt-7 rounded-2xl border border-border bg-card p-5 sm:p-7">
        <h2 className="text-lg font-bold">Preparar exame</h2>
        <p className="mt-1 text-sm text-muted-foreground">Preenche apenas os dados essenciais para criar um exame adaptado ao teu nível.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="exam-subject">Disciplina</Label><Input id="exam-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex.: Matemática" /></div>
          <div className="space-y-2"><Label htmlFor="exam-level">Nível / classe / curso</Label><Input id="exam-level" value={level} onChange={e => setLevel(e.target.value)} placeholder="Ex.: 12.ª classe" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="exam-topic">Matéria ou tema</Label><Input id="exam-topic" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex.: Funções, trigonometria e equações" /></div>
          <div className="space-y-2"><Label>Tipo de exame</Label><div className="grid grid-cols-2 gap-2"><Button type="button" variant={type === "simulado" ? "brand" : "glass"} onClick={() => setType("simulado")}>Simulado</Button><Button type="button" variant={type === "anterior" ? "brand" : "glass"} onClick={() => setType("anterior")}>Modelo anterior</Button></div></div>
          <div className="space-y-2"><Label htmlFor="exam-count">Número de perguntas</Label><select id="exam-count" value={questionCount} onChange={e => setQuestionCount(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="5">5 perguntas</option><option value="10">10 perguntas</option><option value="15">15 perguntas</option><option value="20">20 perguntas</option></select></div>
        </div>
        {type === "anterior" && <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Serão criadas questões-modelo inspiradas no formato de exames anteriores. Para provas oficiais de anos específicos, consulta também os documentos originais da escola ou do Ministério da Educação.</p>}
        <Button className="mt-5 w-full" variant="brand" onClick={createExam} disabled={loading}>{loading ? <><span className="animate-spin">◌</span> A preparar exame...</> : <><Sparkles className="h-4 w-4" /> Gerar exame</>}</Button>
      </section>}

      {exam && <section className="mt-7 space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-bold">{exam.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{exam.notice}</p>
          <p className="mt-2 text-sm font-medium">{exam.questions.length} perguntas · {subject} · {level}</p>
        </div>
        {exam.questions.map((q, i) => <article key={i} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h3 className="font-semibold leading-relaxed">{i + 1}. {q.question}</h3>
          <div className="mt-4 space-y-2">
            {q.options.map((option, j) => {
              const chosen = answers[i] === j;
              const correct = submitted && q.correctAnswer === j;
              const wrong = submitted && chosen && q.correctAnswer !== j;
              return <button key={j} type="button" onClick={() => !submitted && setAnswers(prev => ({ ...prev, [i]: j }))} disabled={submitted} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${correct ? "border-green-600 bg-green-50 text-green-950" : wrong ? "border-red-500 bg-red-50 text-red-950" : chosen ? "border-primary bg-primary/10" : "border-border hover:bg-muted/60"}`}>
                <span className="font-bold">{String.fromCharCode(65 + j)}.</span><span>{option}</span>{correct && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0" />}
              </button>;
            })}
          </div>
          {submitted && <div className="mt-4 rounded-xl bg-muted p-4 text-sm"><p className="font-semibold">Explicação</p><p className="mt-1">{q.explanation}</p></div>}
        </article>)}
        <div className="sticky bottom-3 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:p-4">
          {submitted ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="font-bold">Resultado: {score}/{exam.questions.length} ({Math.round(score / exam.questions.length * 100)}%)</p><div className="flex gap-2"><Button variant="glass" onClick={() => { setExam(null); setAnswers({}); setSubmitted(false); }}><RotateCcw className="h-4 w-4" /> Novo exame</Button><Button variant="brand" onClick={() => { setAnswers({}); setSubmitted(false); }}>Tentar novamente</Button></div></div> : <Button variant="brand" className="w-full" onClick={() => { if (Object.keys(answers).length < exam.questions.length) { toast.error("Responde a todas as perguntas antes de corrigir."); return; } setSubmitted(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Corrigir respostas</Button>}
        </div>
      </section>}
    </main>
  );
}
