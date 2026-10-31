import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS } from "@/lib/plans";
import { improveCurriculumWithAI } from "@/lib/curriculum-ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BadgeCheck, Camera, CheckCircle2, ClipboardList, Copy, Download, FileText, Loader2, LockKeyhole, Sparkles, UserRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/curriculo")({
  head: () => ({
    meta: [
      { title: "Criar currículo profissional | RuJe IA" },
      { name: "description", content: "Crie um currículo profissional em PDF por 125 MT." },
    ],
  }),
  component: CurriculoPage,
});

const PRODUCT_NAME = "Currículo profissional";
const PRICE = 125;

function isApproved(status: unknown) {
  return /^(aprovado|aprovada|approved|pago|paid)$/i.test(String(status ?? "").trim());
}
function isPending(status: unknown) {
  return /^pend/i.test(String(status ?? "").trim());
}
function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Não foi possível ler a fotografia."));
    reader.onerror = () => reject(new Error("Não foi possível ler a fotografia."));
    reader.readAsDataURL(file);
  });
}
function cleanFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "curriculo";
}

function CurriculoPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(PAYMENT_METHODS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFormat, setPhotoFormat] = useState<"JPEG" | "PNG">("JPEG");
  const [photoName, setPhotoName] = useState("");
  const pay = PAYMENT_METHODS.find((item) => item.id === method)!;

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["curriculum-payment", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("id, plan, amount, method, created_at, status")
        .eq("user_id", user.id)
        .eq("plan", PRODUCT_NAME)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approved = useMemo(() => payments.some((payment) => Number(payment.amount) === PRICE && isApproved(payment.status)), [payments]);
  const pending = useMemo(() => payments.some((payment) => Number(payment.amount) === PRICE && isPending(payment.status)), [payments]);
  const latestRequest = payments[0];

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(pay.number);
      toast.success("Número de pagamento copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecciona o número manualmente.");
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending || approved) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const fullName = String(fields.get("full_name") ?? "").trim();
    const phone = String(fields.get("phone") ?? "").trim();
    const proof = String(fields.get("proof") ?? "").trim();
    if (!fullName || !phone || !proof) {
      toast.error("Preenche o nome, telefone e referência do pagamento.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      plan: PRODUCT_NAME,
      amount: PRICE,
      method: pay.name,
      full_name: fullName,
      phone,
      proof,
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o pedido. Verifica os dados e tenta novamente.");
      return;
    }
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["curriculum-payment", user.id] });
    await queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    toast.success("Comprovativo enviado. O currículo ficará disponível após a aprovação.");
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Usa uma fotografia em JPG ou PNG.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A fotografia deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }
    try {
      const data = await readFileAsDataUrl(file);
      setPhoto(data);
      setPhotoFormat(file.type === "image/png" ? "PNG" : "JPEG");
      setPhotoName(file.name);
      toast.success("Fotografia adicionada.");
    } catch {
      toast.error("Não foi possível carregar esta fotografia.");
    }
  }

  async function createPdf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    const fullName = value("full_name");
    const profession = value("profession");
    const email = value("email");
    const phone = value("phone");
    const location = value("location");
    const linkedin = value("linkedin");
    const objective = value("objective");
    const summary = value("summary");
    const experience = value("experience");
    const education = [value("education"), value("education_details")].filter(Boolean).join(" — ");
    const skills = value("skills");
    const languages = value("languages");
    const courses = value("courses");
    const selectedSkills = fields.getAll("skill_choice").map(String);
    const selectedLanguages = fields.getAll("language_choice").map(String);
    setAiBusy(true);
    let enhanced: Awaited<ReturnType<typeof improveCurriculumWithAI>>;
    try {
      enhanced = await improveCurriculumWithAI({
        data: {
          fullName, profession, education, experience,
          skills: selectedSkills,
          otherSkills: value("skills"),
          languages: selectedLanguages,
          objective, location, email, phone, courses,
          photoIncluded: Boolean(photo),
        },
      });
    } catch (error) {
      setAiBusy(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível organizar o currículo.");
      return;
    }
    setAiBusy(false);

    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const left = 18;
    const right = 18;
    const contentWidth = pageWidth - left - right;
    let y = 18;

    pdf.setFillColor(19, 91, 55);
    pdf.rect(0, 0, pageWidth, 54, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(21);
    pdf.text(fullName, left, 22, { maxWidth: photo ? 122 : contentWidth });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(enhanced.professionalTitle || profession, left, 30, { maxWidth: photo ? 122 : contentWidth });
    const contact = [phone, email, location, linkedin].filter(Boolean).join("  |  ");
    const contactLines = pdf.splitTextToSize(contact, photo ? 122 : contentWidth);
    pdf.setFontSize(8.5);
    pdf.text(contactLines, left, 38);
    if (photo) {
      try {
        pdf.addImage(photo, photoFormat, pageWidth - right - 31, 9, 31, 37, undefined, "FAST");
      } catch {
        toast.error("A fotografia não pôde ser inserida. Remove-a ou carrega outra imagem.");
        return;
      }
    }
    y = 66;

    const addSection = (heading: string, body: string, required = false) => {
      if (!body && !required) return;
      const text = body || "Não indicado.";
      const lines = pdf.splitTextToSize(text, contentWidth);
      const needed = 12 + lines.length * 4.8;
      if (y + needed > pageHeight - 18) {
        pdf.addPage();
        y = 20;
      }
      pdf.setTextColor(19, 91, 55);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.text(heading.toUpperCase(), left, y);
      pdf.setDrawColor(198, 222, 205);
      pdf.setLineWidth(0.35);
      pdf.line(left, y + 2, pageWidth - right, y + 2);
      y += 8;
      pdf.setTextColor(48, 59, 52);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      for (const line of lines) {
        if (y > pageHeight - 17) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, left, y);
        y += 4.8;
      }
      y += 5;
    };

    addSection("Perfil profissional", enhanced.profile || summary, true);
    addSection("Objectivo profissional", enhanced.objective || objective);
    addSection("Experiência profissional", enhanced.experience || experience);
    addSection("Formação académica", enhanced.education || education, true);
    addSection("Competências", enhanced.skills || [skills, selectedSkills.join(", ")].filter(Boolean).join("\\n"), true);
    addSection("Idiomas", enhanced.languages || [languages, selectedLanguages.join(", ")].filter(Boolean).join("\\n"));
    addSection("Cursos e certificações", enhanced.courses || courses);

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page++) {
      pdf.setPage(page);
      pdf.setDrawColor(220, 232, 223);
      pdf.line(left, pageHeight - 12, pageWidth - right, pageHeight - 12);
      pdf.setTextColor(120, 135, 125);
      pdf.setFontSize(8);
      pdf.text("Currículo profissional · RuJe IA", left, pageHeight - 7);
      pdf.text(`Página ${page} de ${pageCount}`, pageWidth - right, pageHeight - 7, { align: "right" });
    }
    pdf.save(`curriculo-${cleanFileName(fullName)}.pdf`);
    toast.success("O teu currículo profissional foi criado e descarregado em PDF.");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="rounded-3xl border border-[#dcebe0] bg-gradient-to-br from-white to-[#eaf7ee] p-5 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e8f6ec] text-[#16834a]"><FileText className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#16834a]">Novo serviço RuJe IA</span>
            <h1 className="mt-1 text-2xl font-extrabold text-[#17251d] sm:text-3xl">Criação de Currículo Profissional</h1>
            <p className="mt-2 text-sm text-[#66766c]">Responde a algumas perguntas e recebe um currículo organizado, elegante e pronto para enviar às empresas.</p>
          </div>
          <div className="hidden rounded-2xl bg-white px-4 py-3 text-center shadow-sm sm:block"><p className="text-2xl font-extrabold text-[#16834a]">125 MT</p><p className="text-xs text-[#718078]">pagamento único</p></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-[#39734e]">
          <span className="rounded-full bg-white px-3 py-1.5">PDF profissional</span>
          <span className="rounded-full bg-white px-3 py-1.5">Fotografia opcional</span>
          <span className="rounded-full bg-white px-3 py-1.5">Dados organizados</span>
        </div>
      </header>

      {isLoading ? (
        <div className="mt-6 rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />A verificar o pagamento...</div>
      ) : approved ? (
        <section className="mt-6 rounded-2xl border border-[#cfe5d5] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 text-[#16834a]"><CheckCircle2 className="h-5 w-5" /><p className="font-bold">Pagamento confirmado · Serviço desbloqueado</p></div>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#f2f8f3] p-4"><ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#16834a]" /><div><h2 className="font-bold text-[#203128]">Questionário para o teu currículo</h2><p className="mt-1 text-sm text-[#66766c]">Preenche com informações verdadeiras. Se ainda não tens experiência profissional, indica estágios, voluntariado, projectos ou actividades relevantes — apenas se realmente os fizeste.</p></div></div>
          <form className="mt-6 space-y-6" onSubmit={createPdf}>
            <section className="space-y-4">
              <h3 className="flex items-center gap-2 font-bold text-[#203128]"><UserRound className="h-4 w-4 text-[#16834a]" /> 1. Sobre ti</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="cv-name">Nome completo *</Label><Input id="cv-name" name="full_name" required placeholder="Escreve o teu nome completo" /></div>
                <div className="space-y-2"><Label htmlFor="cv-profession">Área profissional / ocupação *</Label><select id="cv-profession" name="profession" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecciona uma área</option>{["Estudante","Administração e escritório","Contabilidade e finanças","Informática e tecnologia","Educação e ensino","Saúde","Vendas e comércio","Atendimento ao cliente","Construção civil","Electricidade e mecânica","Hotelaria e turismo","Agricultura","Comunicação e marketing","Design e criatividade","Motorista e transportes","Segurança","Gestão e empreendedorismo","Outra área"].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="cv-phone">Telefone / WhatsApp *</Label><Input id="cv-phone" name="phone" required placeholder="+258 ..." /></div>
                <div className="space-y-2"><Label htmlFor="cv-email">E-mail</Label><Input id="cv-email" name="email" type="email" placeholder="nome@email.com" /></div>
                <div className="space-y-2"><Label htmlFor="cv-location">Cidade / Província</Label><Input id="cv-location" name="location" placeholder="Ex.: Nampula, Moçambique" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="cv-linkedin">LinkedIn ou portfólio (opcional)</Label><Input id="cv-linkedin" name="linkedin" placeholder="https://..." /></div>
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <h3 className="flex items-center gap-2 font-bold text-[#203128]"><Sparkles className="h-4 w-4 text-[#16834a]" /> 2. O teu perfil profissional</h3>
              <div className="space-y-2"><Label htmlFor="cv-summary">Fala um pouco sobre ti, o que sabes fazer e os teus pontos fortes *</Label><Textarea id="cv-summary" name="summary" required rows={4} placeholder="Ex.: Sou dedicado, tenho conhecimentos de informática, gosto de trabalhar em equipa..." /></div>
              <div className="space-y-2"><Label htmlFor="cv-objective">Que tipo de trabalho ou oportunidade procuras?</Label><Textarea id="cv-objective" name="objective" rows={2} placeholder="Ex.: Procuro uma oportunidade na área administrativa..." /></div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <h3 className="flex items-center gap-2 font-bold text-[#203128]"><ClipboardList className="h-4 w-4 text-[#16834a]" /> 3. Formação e experiência</h3>
              <div className="space-y-2"><Label htmlFor="cv-education">Nível de formação concluído ou frequentado *</Label><select id="cv-education" name="education" required defaultValue="" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecciona o teu nível</option>{["Ensino primário","Ensino básico","Ensino secundário (10ª classe)","Ensino médio (12ª classe)","Técnico profissional básico","Técnico profissional médio","Licenciatura","Pós-graduação","Mestrado","Doutoramento","A frequentar formação / estudos","Outro"].map(v => <option key={v} value={v}>{v}</option>)}</select><Label htmlFor="cv-school-details">Instituição, curso e ano (opcional)</Label><Textarea id="cv-school-details" name="education_details" rows={2} placeholder="Nome da escola ou instituição, curso e ano de conclusão." /></div>
              <div className="space-y-2"><Label htmlFor="cv-experience">Já trabalhaste? Onde e quais eram as tuas tarefas?</Label><Textarea id="cv-experience" name="experience" rows={4} placeholder="Indica empresa, função, período e principais responsabilidades. Se nunca trabalhaste, podes deixar em branco." /></div>
              <div className="space-y-3"><Label>O que sabes fazer? Selecciona todas as opções verdadeiras *</Label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{["Microsoft Word","Microsoft Excel","PowerPoint","Informática básica","Atendimento ao cliente","Vendas","Comunicação","Trabalho em equipa","Liderança","Organização","Contabilidade","Gestão","Design gráfico","Programação","Redes sociais","Marketing digital","Condução","Electricidade","Mecânica","Línguas"].map((item) => <label key={item} className="flex items-center gap-2 rounded-xl border border-[#dcebe0] bg-white p-3 text-sm"><input type="checkbox" name="skill_choice" value={item} className="accent-[#16834a]" />{item}</label>)}</div><Label htmlFor="cv-skills">Outras competências (opcional)</Label><Textarea id="cv-skills" name="skills" rows={2} placeholder="Acrescenta outras competências que realmente possuis." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Que idiomas falas? (podes seleccionar vários)</Label><div className="grid grid-cols-2 gap-2">{["Português","Inglês","Francês","Espanhol","Changana","Emakhuwa","Cisena","Xichangana","Cinyanja","Outro"].map((item) => <label key={item} className="flex items-center gap-2 rounded-xl border border-[#dcebe0] bg-white p-3 text-sm"><input type="checkbox" name="language_choice" value={item} className="accent-[#16834a]" />{item}</label>)}</div><Label htmlFor="cv-languages">Indica o teu nível em cada idioma (opcional)</Label><Textarea id="cv-languages" name="languages" rows={2} placeholder="Ex.: Português — fluente; Inglês — básico." /></div>
                <div className="space-y-2"><Label htmlFor="cv-courses">Cursos, certificados ou formações adicionais</Label><Textarea id="cv-courses" name="courses" rows={2} placeholder="Indica apenas os cursos que concluíste." /></div>
              </div>
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <h3 className="flex items-center gap-2 font-bold text-[#203128]"><Camera className="h-4 w-4 text-[#16834a]" /> 4. Fotografia para o currículo</h3>
              <div className="rounded-2xl border border-[#dcebe0] bg-[#f7fbf8] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="grid h-24 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#dcebe0] bg-white text-[#8a9a8f]">{photo ? <img src={photo} alt="Pré-visualização da fotografia do currículo" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9" />}</div>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-[#203128]">Recomendamos uma fotografia profissional</p><p className="mt-1 text-sm text-[#66766c]">Escolhe uma imagem nítida, bem iluminada, com o rosto totalmente visível, de frente e com fundo simples. Evita filtros, óculos escuros, selfies cortadas ou fotografias de grupo.</p>{photoName && <p className="mt-2 truncate text-xs text-[#16834a]">{photoName}</p>}</div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2"><Label htmlFor="cv-photo" className="sr-only">Adicionar fotografia</Label><Input id="cv-photo" type="file" accept="image/jpeg,image/png" onChange={handlePhoto} className="max-w-sm bg-white" /><span className="text-xs text-muted-foreground">JPG ou PNG · máximo 5 MB · opcional</span>{photo && <Button type="button" size="sm" variant="glass" onClick={() => { setPhoto(null); setPhotoName(""); }}>Remover foto</Button>}</div>
              </div>
            </section>

            <div className="rounded-xl border border-[#cfe5d5] bg-[#f2f8f3] p-4 text-sm text-[#476653]">Antes de gerar, confirma que os dados estão correctos. A RuJe IA organiza as informações que forneceste e não acrescenta experiências, diplomas ou competências que não declaraste.</div>
            <Button type="submit" variant="brand" size="lg" className="h-12 w-full" disabled={aiBusy}>{aiBusy ? <><Loader2 className="h-5 w-5 animate-spin" /> A IA está a organizar o teu currículo...</> : <><Sparkles className="h-5 w-5" /> Melhorar com IA e baixar PDF</>}</Button>
          </form>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-[#dcebe0] bg-white p-5 shadow-sm sm:p-7">
          {pending ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="flex items-center gap-2 font-bold"><LockKeyhole className="h-5 w-5" /> Pagamento em verificação</p><p className="mt-1 text-sm">O teu comprovativo foi enviado{latestRequest?.created_at ? ` em ${new Date(latestRequest.created_at).toLocaleDateString("pt-PT")}` : ""}. O questionário será desbloqueado assim que o administrador aprovar o pagamento.</p><Button type="button" variant="glass" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ["curriculum-payment", user.id] })}>Actualizar estado</Button></div>
          ) : (
            <>
              <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[#16834a]" /><h2 className="text-lg font-bold text-[#203128]">Desbloqueia a criação do teu currículo</h2></div>
              <p className="mt-2 text-sm text-[#66766c]">Faz um pagamento único de <strong>125 MT</strong>. Depois da aprovação, poderás preencher o questionário e gerar o teu PDF.</p>
              <div className="mt-5 rounded-xl bg-[#f2f8f3] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#718078]">Preço do serviço</p><p className="mt-1 text-3xl font-extrabold text-[#16834a]">125 MT</p><p className="text-xs text-[#718078]">Pagamento único · um currículo em PDF</p></div>
              <form className="mt-5 space-y-4" onSubmit={submitPayment}>
                <div className="space-y-2"><Label>Método de pagamento</Label><div className="grid grid-cols-2 gap-2">{PAYMENT_METHODS.map((item) => <Button key={item.id} type="button" variant={method === item.id ? "brand" : "glass"} onClick={() => setMethod(item.id)}>{item.name}</Button>)}</div></div>
                <div className="rounded-xl border border-border bg-muted/40 p-4"><p className="text-sm">Envia <strong>125 MT</strong> para:</p><p className="mt-2 text-xl font-extrabold">{pay.number}</p><p className="text-sm text-muted-foreground">{pay.holder}</p><Button type="button" variant="glass" size="sm" className="mt-3" onClick={copyNumber}><Copy className="h-4 w-4" /> Copiar número</Button></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="cv-pay-name">Nome completo</Label><Input id="cv-pay-name" name="full_name" required placeholder="Nome de quem pagou" /></div><div className="space-y-2"><Label htmlFor="cv-pay-phone">Telefone usado no pagamento</Label><Input id="cv-pay-phone" name="phone" required placeholder="84... / 85... / 86... / 87..." /></div></div>
                <div className="space-y-2"><Label htmlFor="cv-pay-proof">Comprovativo ou referência da transacção</Label><Textarea id="cv-pay-proof" name="proof" required placeholder="Código ou mensagem de confirmação do pagamento." /></div>
                <Button type="submit" variant="brand" className="w-full" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> A enviar pedido...</> : <><BadgeCheck className="h-4 w-4" /> Pagar 125 MT e desbloquear</>}</Button>
              </form>
            </>
          )}
        </section>
      )}
    </main>
  );
}
