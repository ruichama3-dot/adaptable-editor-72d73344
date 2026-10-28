import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

const ExamInput = z.object({
  subject: z.string().trim().min(2).max(120),
  level: z.string().trim().min(2).max(80),
  topic: z.string().trim().min(2).max(240),
  type: z.enum(["simulado", "anterior"]),
  questionCount: z.number().int().min(5).max(20),
});

export type ExamQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export const generateExam = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(ExamInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
      || process.env.GOOGLE_API_KEY?.trim()
      || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) throw new Error("O serviço de IA não está configurado. O administrador deve configurar GEMINI_API_KEY na Vercel.");

    const sourceInstruction = data.type === "anterior"
      ? "O utilizador quer estudar exames anteriores. Não afirmes que perguntas são de uma prova oficial real, nem inventes instituição, ano ou proveniência. Produz questões-modelo semelhantes a exames anteriores e assinala que devem ser confirmadas com a prova oficial."
      : "Cria um exame simulado original para prática.";
    const prompt = `És um professor experiente no contexto escolar de Moçambique. ${sourceInstruction}
Disciplina: ${data.subject}
Nível/classe/curso: ${data.level}
Matéria/tema: ${data.topic}
Número de questões: ${data.questionCount}
Cria questões de escolha múltipla com exactamente 4 opções cada. Inclui uma resposta correcta (índice de 0 a 3) e uma explicação curta e didáctica. Mistura dificuldade fácil, média e difícil. Não inventes factos como se fossem oficiais. Responde APENAS com JSON válido neste formato: {"title":"...","notice":"...","questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"..."}]}`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, responseMimeType: "application/json", maxOutputTokens: 8192 },
      }),
    });
    if (!response.ok) throw new Error("Não foi possível gerar o exame agora. Verifica a chave Gemini e tenta novamente.");
    const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? "").join("") ?? "";
    let parsed: { title?: string; notice?: string; questions?: ExamQuestion[] };
    try { parsed = JSON.parse(raw); } catch { throw new Error("A IA devolveu uma resposta inválida. Tenta novamente."); }
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 1) throw new Error("Não foram recebidas questões válidas. Tenta novamente.");
    const questions = parsed.questions.filter(q =>
      typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4 &&
      Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0 && q.correctAnswer <= 3 &&
      typeof q.explanation === "string"
    );
    if (!questions.length) throw new Error("As questões geradas não passaram na validação. Tenta novamente.");
    return { title: parsed.title || `Exame de ${data.subject}`, notice: parsed.notice || "Material de estudo gerado por IA; confirme os conteúdos com o programa oficial.", questions };
  });
