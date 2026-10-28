import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

const StudyExamInput = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.literal("application/pdf"),
  base64: z.string().min(100).max(18_000_000),
});

export const studyExamWithAI = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(StudyExamInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
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
