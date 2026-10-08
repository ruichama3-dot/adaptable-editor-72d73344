import { useState } from "react";
import { FileText, FileType2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadPdf, downloadWord } from "@/lib/download-work";

type Props = {
  title: string;
  getHtml: () => string;
  onDownloaded?: () => void;
};

/** Botões directos (sem menu) — mais fiáveis em ecrãs tácteis. */
export function DownloadWorkButton({ title, getHtml, onDownloaded }: Props) {
  const [busy, setBusy] = useState<null | "pdf" | "word">(null);

  async function download(format: "pdf" | "word") {
    if (busy) return;
    const html = getHtml();
    if (!html.trim()) {
      toast.error("O trabalho ainda está a carregar. Aguarde um momento.");
      return;
    }
    setBusy(format);
    const toastId = toast.loading("A preparar o ficheiro…");
    try {
      if (format === "pdf") await downloadPdf(title, html);
      else await downloadWord(title, html);
      toast.success("Download iniciado.", { id: toastId });
      onDownloaded?.();
    } catch (err) {
      console.error("[download]", err);
      toast.error("Não foi possível descarregar o trabalho. Tente novamente.", { id: toastId });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
      <Button type="button" disabled={busy !== null} onClick={() => void download("pdf")}>
        {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} Baixar PDF
      </Button>
      <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void download("word")}>
        {busy === "word" ? <Loader2 className="animate-spin" /> : <FileType2 />} Baixar Word
      </Button>
    </div>
  );
}
