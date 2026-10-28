import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpenCheck, BrainCircuit, CheckCircle2, Copy, Download, FileText, Loader2, ShoppingCart, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { studyExamWithAI } from "@/lib/exam-study.functions";
import { listApprovedExams, getApprovedExamPdf } from "@/lib/exam-library.functions";

export const Route = createFileRoute("/_authenticated/exames")({
  head: () => ({ meta: [{ title: "Comprar exames e estudar com IA | RuJe IA" }, { name: "description", content: "Compra exames por 125 MT e prepara-te com aulas explicadas por IA." }] }),
  component: ExamesPage,
});

const METHODS = [
  { id: "emola", name: "Emola", number: "872954503", holder: "Laura Ermelindo" },
  { id: "mpesa", name: "M-Pesa", number: "851589567", holder: "JEREMIAS NIUONENO ROMAO" },
];

function ExamesPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const study = useServerFn(studyExamWithAI);
  const listExams = useServerFn(listApprovedExams);
  const getExamPdf = useServerFn(getApprovedExamPdf);
  const [method, setMethod] = useState("emola");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [lesson, setLesson] = useState("");
  const [studying, setStudying] = useState(false);
  const [activeExam, setActiveExam] = useState("");
  const pay = METHODS.find(m => m.id === method)!;

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["exam-purchase-status", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const purchase = requests.find((p: any) => String(p.plan ?? "").toLowerCase() === "pacote de exames");
  const isApproved = Boolean(purchase && /aprov|approved|pago/i.test(String(purchase.status ?? "")));
  const isPending = Boolean(purchase && /pend/i.test(String(purchase.status ?? "")));
  const { data: libraryExams = [], isLoading: loadingExams, error: libraryError, refetch: refreshExams } = useQuery({
    queryKey: ["approved-exam-library", user.id],
    queryFn: () => listExams({ data: {} }),
    enabled: isApproved,
    staleTime: 60_000,
  });

  async function copyNumber() {
    await navigator.clipboard.writeText(pay.number).catch(() => undefined);
    toast.success("Número copiado.");
  }

  async function buyExams(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || isPending || isApproved) return;
    const form = e.currentTarget;
    const fields = new FormData(form);
    const fullName = String(fields.get("full_name") ?? "").trim();
    const phone = String(fields.get("phone") ?? "").trim();
    const proof = String(fields.get("proof") ?? "").trim();
    if (!fullName || !phone || !proof) {
      toast.error("Preenche o nome, telefone e comprovativo ou referência da transação.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      plan: "Pacote de exames",
      amount: 125,
      method: pay.name,
      full_name: fullName,
      phone,
      proof,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido. Tenta novamente.");
      return;
    }
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["exam-purchase-status", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    toast.success("Pedido enviado. O acesso será liberado depois da aprovação do pagamento.");
  }

  async function studyUploadedExam() {
    if (!file) {
      toast.error("Escolhe o PDF do exame primeiro.");
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Só são aceites documentos PDF.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("O PDF deve ter no máximo 12 MB.");
      return;
    }
    setStudying(true);
    setLesson("");
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const base64 = btoa(binary);
      const result = await study({ data: { fileName: file.name, mimeType: "application/pdf", base64 } });
      setLesson(result.lesson);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível analisar o exame.");
    } finally {
      setStudying(false);
    }
  }

  function downloadLesson() {
    if (!lesson) return;
    const blob = new Blob([lesson], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aula-de-preparacao-ruje-ia.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary"><BookOpenCheck className="h-7 w-7" /></div>
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">Comprar exames</h1><p className="mt-1 text-muted-foreground">Prepara-te para as provas com exames e explicações inteligentes.</p></div>
      </div>

      <section className="mt-7 rounded-2xl border-2 border-primary/30 bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><ShoppingCart className="h-3.5 w-3.5" /> PACOTE DE EXAMES</span><h2 className="mt-3 text-2xl font-extrabold">Acesso por 125 MT</h2><p className="mt-1 text-sm text-muted-foreground">Consulta os exames disponíveis e estuda com explicações passo a passo da IA.</p></div>
          <div className="rounded-2xl bg-primary/10 p-4 text-center"><p className="text-3xl font-extrabold">125 MT</p><p className="text-xs text-muted-foreground">pagamento único</p></div>
        </div>
        {isLoading ? <p className="mt-5 text-sm text-muted-foreground">A verificar o teu acesso...</p> : isApproved ? <div className="mt-5 rounded-xl border border-green-600/30 bg-green-50 p-4 text-sm text-green-950"><p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" /> Pagamento aprovado</p><p className="mt-1">O teu acesso ao pacote de exames está confirmado.</p></div> : isPending ? <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="font-bold">Pagamento em verificação</p><p className="mt-1 text-sm text-muted-foreground">O pedido foi enviado. Assim que o administrador aprovar o pagamento, esta área será desbloqueada.</p><Button className="mt-3" variant="glass" onClick={() => queryClient.invalidateQueries({ queryKey: ["exam-purchase-status", user.id] })}>Atualizar estado</Button></div> : <form className="mt-6 space-y-4" onSubmit={buyExams}>
          <div className="space-y-2"><Label>Método de pagamento</Label><div className="grid grid-cols-2 gap-2">{METHODS.map(m => <Button key={m.id} type="button" variant={method === m.id ? "brand" : "glass"} onClick={() => setMethod(m.id)}>{m.name}</Button>)}</div></div>
          <div className="rounded-xl bg-muted p-4"><p className="text-sm">Envia <strong>125 MT</strong> para:</p><p className="mt-2 text-lg font-extrabold">{pay.number}</p><p className="text-sm text-muted-foreground">{pay.holder}</p><Button className="mt-3" type="button" variant="glass" size="sm" onClick={copyNumber}><Copy className="h-4 w-4" /> Copiar número</Button></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="exam-buyer-name">Nome completo</Label><Input id="exam-buyer-name" name="full_name" required placeholder="O teu nome" /></div><div className="space-y-2"><Label htmlFor="exam-buyer-phone">Telefone usado no pagamento</Label><Input id="exam-buyer-phone" name="phone" required placeholder="84... / 85... / 86... / 87..." /></div></div>
          <div className="space-y-2"><Label htmlFor="exam-proof">Comprovativo ou referência da transação</Label><Textarea id="exam-proof" name="proof" required placeholder="Indica o código da transação ou informação do comprovativo." /></div>
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> A enviar pedido...</> : <><ShoppingCart className="h-4 w-4" /> Comprar exames por 125 MT</>}</Button>
        </form>}
      </section>

      {isApproved && <section className="mt-7 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-extrabold">Biblioteca de exames</h2><p className="mt-1 text-sm text-muted-foreground">Exames guardados no armazenamento privado da RuJe IA. O acesso é verificado no servidor.</p></div><Button variant="glass" onClick={() => refreshExams()} disabled={loadingExams}>{loadingExams ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar biblioteca"}</Button></div>
        {loadingExams ? <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />A carregar os exames...</div> : libraryError ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Não foi possível carregar os exames. Atualiza a página; se o problema continuar, verifica a configuração do armazenamento Blob na Vercel.</div> : libraryExams.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-2 font-semibold">Ainda não foram encontrados PDFs</p><p className="mt-1 text-sm text-muted-foreground">Confirma se os ficheiros estão no armazenamento privado ligado ao projecto e se terminam em .pdf.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{libraryExams.map((exam: { pathname: string; fileName: string; size: number; subject: string; year: string; label: string }) => <article key={exam.pathname} className="rounded-xl border bg-card p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="break-words font-bold">{exam.label || exam.fileName}</h3><p className="mt-1 text-xs text-muted-foreground">{exam.subject}{exam.year ? ` · ${exam.year}` : ""} · {(exam.size / (1024 * 1024)).toFixed(1)} MB</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="glass" size="sm" onClick={async () => { try { setActiveExam(exam.pathname); const pdf = await getExamPdf({ data: { pathname: exam.pathname } }); const binary = atob(pdf.base64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível abrir o exame."); } finally { setActiveExam(""); } }} disabled={activeExam === exam.pathname}><Download className="h-4 w-4" /> Abrir PDF</Button><Button variant="brand" size="sm" onClick={async () => { try { setActiveExam(exam.pathname); setLesson(""); const pdf = await getExamPdf({ data: { pathname: exam.pathname } }); const result = await study({ data: { fileName: pdf.fileName, mimeType: "application/pdf", base64: pdf.base64 } }); setLesson(result.lesson); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível analisar o exame."); } finally { setActiveExam(""); } }} disabled={studying || activeExam === exam.pathname}><BrainCircuit className="h-4 w-4" /> Estudar com IA</Button></div></article>)}</div>}
        <div className="rounded-xl border border-dashed p-4"><h3 className="font-bold">Estudar outro exame</h3><p className="mt-1 text-sm text-muted-foreground">Também podes carregar um PDF teu para análise, até 12 MB.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1 space-y-2"><Label htmlFor="exam-pdf">Ficheiro do exame (PDF)</Label><Input id="exam-pdf" type="file" accept="application/pdf,.pdf" onChange={e => { setFile(e.target.files?.[0] ?? null); setLesson(""); }} /></div><Button variant="brand" onClick={studyUploadedExam} disabled={studying || !file}>{studying ? <><Loader2 className="h-4 w-4 animate-spin" /> A analisar...</> : <><BrainCircuit className="h-4 w-4" /> Estudar PDF</>}</Button></div>{file && <p className="mt-2 text-xs text-muted-foreground">Selecionado: {file.name}</p>}</div>
        {lesson && <article className="rounded-2xl border border-border bg-card p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-xl font-extrabold">Aula de preparação</h3><Button variant="glass" onClick={downloadLesson}><Download className="h-4 w-4" /> Baixar aula</Button></div><div className="mt-5 whitespace-pre-wrap text-sm leading-7">{lesson}</div></article>}
      </section>}
      <p className="mt-6 text-xs text-muted-foreground">Nota: a IA é uma ferramenta de estudo. Confirma sempre as respostas com os materiais oficiais do professor ou da instituição.</p>
    </main>
  );
}
