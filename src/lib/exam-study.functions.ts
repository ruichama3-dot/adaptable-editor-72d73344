import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";
import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

const StudyExamInput = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.literal("application/pdf"),
  base64: z.string().min(100).max(18_000_000),
});

export const studyExamWithAI = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(StudyExamInput)
  .handler(async ({ data, context }) => {
    // A interface não é uma barreira de segurança: confirmar a compra no servidor
    // antes de enviar qualquer PDF para o serviço de IA.
    const { data: payments, error: paymentError } = await context.supabase
      .from("payment_requests")
      .select("id, status, amount, plan")
      .eq("user_id", context.userId)
      .eq("plan", "Pacote de exames");

    if (paymentError) {
      console.error("[RuJe IA exames] Não foi possível confirmar o pagamento", paymentError.message);
      throw new Error("Não foi possível confirmar o teu acesso. Atualiza a página e tenta novamente.");
    }

    const hasApprovedPurchase = (payments ?? []).some((payment) =>
      Number(payment.amount) >= 125 &&
      /^(aprovado|aprovada|approved|pago|paid)$/i.test(String(payment.status ?? "").trim())
    );

    if (!hasApprovedPurchase) {
      throw new Error("O estudo com IA está disponível depois da aprovação do pagamento de 125 MT.");
    }

    // Reutiliza uma aula já preparada para este PDF. Assim, abrir o mesmo exame\n    // novamente não faz uma nova chamada paga à API Gemini.\n    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();\n    const cacheKey = createHash("sha256").update(data.fileName).update(":").update(data.base64).digest("hex");\n    const cachePath = `exam-lessons/${cacheKey}.json`;\n    if (blobToken) {\n      try {\n        const cached = await get(cachePath, { access: "private", token: blobToken });\n        if (cached) {\n          const cachedText = await new Response(cached.stream).text();\n          const saved = JSON.parse(cachedText) as { lesson?: string };\n          if (saved.lesson?.trim()) return { lesson: saved.lesson, cached: true };\n        }\n      } catch { /* Cache ausente: preparar a aula uma única vez. */ }\n    }\n\n    const apiKey = process.env.GEMINI_API_KEY?.trim()
      || process.env.GOOGLE_API_KEY?.trim()
      || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) throw new Error("O serviço de IA não está configurado. O administrador deve configurar GEMINI_API_KEY na Vercel.");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: `Analisa cuidadosamente o documento de exame PDF anexado, página por página. Responde em português claro usado em Moçambique e cria uma aula de preparação organizada: (1) identificação da disciplina/ano apenas se estiver visível no documento; (2) resumo dos conteúdos avaliados; (3) transcrição ou referência a cada pergunta legível; (4) resolução passo a passo; (5) resposta final e justificação; (6) fórmulas/conceitos importantes; (7) erros comuns e dicas para o exame; (8) pequeno teste final de revisão com respostas. Não inventes partes ilegíveis nem afirmes respostas oficiais sem indicação no documento. Quando uma página ou pergunta não estiver legível, avisa claramente. Nome do ficheiro: ${data.fileName}.` },
            { inline_data: { mime_type: "application/pdf", data: data.base64 } }
          ]
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 12000 },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[RuJe IA exames] Gemini error", response.status, detail.slice(0, 300));
      throw new Error("Não foi possível analisar o PDF. Confirma a chave Gemini e tenta novamente com um ficheiro menor.");
    }
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const lesson = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim() ?? "";
    if (!lesson) throw new Error("A IA não conseguiu ler o exame. Experimenta um PDF com texto legível.");
    return { lesson };
  });
