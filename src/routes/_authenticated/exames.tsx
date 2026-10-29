import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { prepareExamLesson } from "@/lib/prepared-exam-lessons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookOpenCheck, CheckCircle2, Copy, Download, FileText, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listApprovedExams, getApprovedExamPdf } from "@/lib/exam-library.functions";

export const Route = createFileRoute("/_authenticated/exames")({
  head: () => ({ meta: [{ title: "Comprar exames e estudar com IA | RuJe IA" }, { name: "description", content: "Consulta exames da 12.ª classe e estuda com aulas organizadas por disciplina." }] }),
  component: ExamesPage,
});

const METHODS = [
  { id: "emola", name: "Emola", number: "872954503", holder: "Laura Ermelindo" },
  { id: "mpesa", name: "M-Pesa", number: "851589567", holder: "JEREMIAS NIUONENO ROMAO" },
];

function ExamesPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const listExams = useServerFn(listApprovedExams);
  const getExamPdf = useServerFn(getApprovedExamPdf);
  const [method, setMethod] = useState("emola");
  const [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState("");
  const [studying, setStudying] = useState(false);
  const [activeExam, setActiveExam] = useState("");
  const [activeLesson, setActiveLesson] = useState("");
  const [examPreview, setExamPreview] = useState<{ pathname: string; url: string; label: string } | null>(null);
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
      toast.error("Faltam alguns dados. Preenche o nome, o telefone e a referência do pagamento.");
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
      toast.error("O pedido não foi enviado. Verifica a ligação e tenta novamente.");
      return;
    }
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["exam-purchase-status", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    toast.success("Pedido enviado. O acesso será liberado depois da aprovação do pagamento.");
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
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">{isApproved ? "Ver Exames" : "Comprar Exames"}</h1><p className="mt-1 text-muted-foreground">{isApproved ? "Abre cada exame para consultar a aula de preparação guardada." : "Compra o pacote de exames e prepara-te para as provas."}</p></div>
      </div>

      <section className="mt-7 rounded-2xl border-2 border-primary/30 bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><ShoppingCart className="h-3.5 w-3.5" /> PACOTE DE EXAMES</span><h2 className="mt-3 text-2xl font-extrabold">Acesso por 125 MT</h2><p className="mt-1 text-sm text-muted-foreground">Consulta cada exame e abre a aula correspondente, organizada por disciplina.</p></div>
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-extrabold">Os teus exames e aulas</h2><p className="mt-1 text-sm text-muted-foreground">Cada exame tem a sua aula de preparação. Podes consultar o enunciado e estudar na mesma página.</p></div><Button variant="glass" onClick={() => refreshExams()} disabled={loadingExams}>{loadingExams ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar biblioteca"}</Button></div>
        {loadingExams ? <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />A carregar os exames...</div> : libraryError ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Neste momento não conseguimos mostrar a biblioteca. Atualiza a página dentro de instantes. Se continuar, contacta o apoio da RuJe IA.</div> : libraryExams.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center"><FileText className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-2 font-semibold">Ainda não foram encontrados PDFs</p><p className="mt-1 text-sm text-muted-foreground">Confirma se os ficheiros estão no armazenamento privado ligado ao projecto e se terminam em .pdf.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{libraryExams.map((exam: { pathname: string; fileName: string; size: number; subject: string; year: string; label: string }) => <article key={exam.pathname} className="rounded-xl border bg-card p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="break-words font-bold">{exam.label || exam.fileName}</h3><p className="mt-1 text-xs text-muted-foreground">{exam.subject}{exam.year ? ` · ${exam.year}` : ""} · {(exam.size / (1024 * 1024)).toFixed(1)} MB</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="glass" size="sm" onClick={async () => { if (examPreview?.pathname === exam.pathname) { URL.revokeObjectURL(examPreview.url); setExamPreview(null); return; } try { setActiveExam(exam.pathname); const pdf = await getExamPdf({ data: { pathname: exam.pathname } }); const binary = atob(pdf.base64); const bytes = new Uint8Array(binary.length); for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); setExamPreview({ pathname: exam.pathname, url, label: exam.label || exam.fileName }); } catch { toast.error("Não foi possível abrir este exame agora. Tenta novamente dentro de instantes."); } finally { setActiveExam(""); } }} disabled={activeExam === exam.pathname}>{activeExam === exam.pathname ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {examPreview?.pathname === exam.pathname ? "Fechar exame" : "Ver exame aqui"}</Button><Button variant="brand" size="sm" onClick={() => { setActiveLesson(activeLesson === exam.pathname ? "" : exam.pathname); setLesson(prepareExamLesson(exam)); toast.success("Aula de preparação aberta."); }}><BookOpenCheck className="h-4 w-4" /> Ver aula deste exame</Button></div>{examPreview?.pathname === exam.pathname && <div className="mt-4 overflow-hidden rounded-xl border bg-background"><div className="flex items-center justify-between gap-2 border-b px-3 py-2"><h4 className="min-w-0 truncate text-sm font-bold">{examPreview.label}</h4><Button variant="ghost" size="sm" onClick={() => { URL.revokeObjectURL(examPreview.url); setExamPreview(null); }}>Fechar</Button></div><iframe title={`Exame: ${examPreview.label}`} src={`${examPreview.url}#toolbar=1&navpanes=0&view=FitH`} className="h-[80vh] min-h-[620px] w-full bg-white" loading="lazy" /></div>}{activeLesson === exam.pathname && lesson && <div className="mt-4 rounded-xl border bg-muted/30 p-4"><div className="flex items-center justify-between gap-2"><h4 className="font-bold">Aula exclusiva deste exame</h4><Button variant="glass" size="sm" onClick={downloadLesson}><Download className="h-4 w-4" /> Baixar aula</Button></div><div className="mt-3 whitespace-pre-wrap text-sm leading-7">{lesson}</div></div>}</article>)}</div>}
      </section>}
      <p className="mt-6 text-xs text-muted-foreground">Dica de estudo: compara as tuas respostas com os conteúdos leccionados pelo professor e revê os passos onde tiveres dúvidas.</p>
    </main>
  );
}
