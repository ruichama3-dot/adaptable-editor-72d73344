import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { get, list } from "@vercel/blob";
import { z } from "zod";

async function requireExamPurchase(context: { supabase: any; userId: string }) {
  const { data: payments, error } = await context.supabase
    .from("payment_requests")
    .select("id, status, amount, plan")
    .eq("user_id", context.userId)
    .eq("plan", "Pacote de exames");
  if (error) throw new Error("Não foi possível confirmar a compra dos exames.");
  const approved = (payments ?? []).some((p: { status?: string; amount?: number | string }) =>
    Number(p.amount) >= 125 && /^(aprovado|aprovada|approved|pago|paid)$/i.test(String(p.status ?? "").trim())
  );
  if (!approved) throw new Error("O acesso à biblioteca exige a aprovação do pagamento de 125 MT.");
}

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("O armazenamento privado de exames não está configurado na Vercel.");
  return token;
}

function metadata(pathname: string, size: number, uploadedAt?: Date | string) {
  const fileName = pathname.split("/").pop() ?? pathname;
  const label = fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const normalized = label.toLowerCase();
  const year = label.match(/\b(20\d{2})\b/)?.[1] ?? "";
  const subject = normalized.includes("matemat") ? "Matemática"
    : normalized.includes("portugues") || normalized.includes("português") ? "Português"
    : normalized.includes("ingles") || normalized.includes("inglês") ? "Inglês"
    : normalized.includes("biologia") ? "Biologia"
    : normalized.includes("fisica") || normalized.includes("física") ? "Física"
    : normalized.includes("quimica") || normalized.includes("química") ? "Química"
    : normalized.includes("historia") || normalized.includes("história") ? "História"
    : normalized.includes("geografia") ? "Geografia" : "Exame";
  return { pathname, fileName, label, subject, year, size, uploadedAt: uploadedAt ? new Date(uploadedAt).toISOString() : null };
}

export const listApprovedExams = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(z.object({}))
  .handler(async ({ context }) => {
    await requireExamPurchase(context);
    const token = getBlobToken();
    const items: ReturnType<typeof metadata>[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ limit: 1000, ...(cursor ? { cursor } : {}), token });
      for (const blob of page.blobs) {
        if (/\.pdf$/i.test(blob.pathname)) items.push(metadata(blob.pathname, blob.size, blob.uploadedAt));
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return items.sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || a.label.localeCompare(b.label, "pt"));
  });

export const getApprovedExamPdf = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(z.object({ pathname: z.string().min(1).max(500) }))
  .handler(async ({ data, context }) => {
    await requireExamPurchase(context);
    if (!/\.pdf$/i.test(data.pathname) || data.pathname.includes("..")) throw new Error("O ficheiro solicitado não é um exame válido.");
    const token = getBlobToken();
    const blob = await get(data.pathname, { access: "private", token });
    if (!blob) throw new Error("Este exame já não está disponível no armazenamento.");
    if (blob.size > 12 * 1024 * 1024) throw new Error("Este PDF excede o limite de 12 MB para análise.");
    const buffer = await new Response(blob.stream).arrayBuffer();
    return { fileName: data.pathname.split("/").pop() ?? "exame.pdf", base64: Buffer.from(buffer).toString("base64") };
  });
