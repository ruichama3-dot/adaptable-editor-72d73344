import { splitPages } from "@/lib/doc-pages";

function safeName(title: string) {
  return title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 100) || "trabalho";
}

export async function downloadWord(title: string, html: string) {
  const { createWordDocument } = await import("@/lib/word-document");
  const blob = await createWordDocument(html);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName(title)}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadPdf(title: string, html: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pages = splitPages(html);

  for (let index = 0; index < pages.length; index++) {
    const sheet = document.createElement("div");
    sheet.innerHTML = pages[index] ?? "";
    // Render a single document sheet in an isolated frame, away from app theme tokens.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:0;top:0;width:794px;height:1123px;opacity:0;pointer-events:none;";
    document.body.appendChild(frame);
    try {
      const frameDoc = frame.contentDocument;
      if (!frameDoc) throw new Error("Não foi possível preparar o PDF.");
      frameDoc.open();
      frameDoc.write(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:794px;background:#fff;color:#111}body{font:12pt/1.5 'Times New Roman',serif;padding:64px 72px;min-height:1122px;overflow-wrap:break-word}h1{font-size:18pt}h2{font-size:15pt}h3{font-size:13pt}p{text-align:justify;margin:0 0 .8em}ul,ol{margin:0 0 .8em 1.4em}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px 8px}table.rosto td{border:none;vertical-align:top}table.rosto td:last-child{text-align:right}img{max-width:100%;height:auto}</style></head><body>${sheet.innerHTML}</body></html>`);
      frameDoc.close();
      await Promise.all(Array.from(frameDoc.images).map((image) => image.decode().catch(() => undefined)));
      const canvas = await html2canvas(frameDoc.body, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794, height: Math.max(1122, frameDoc.body.scrollHeight) });
      const pixelsPerPage = Math.floor((canvas.width * 297) / 210);
      for (let start = 0; start < canvas.height; start += pixelsPerPage) {
        const remaining = canvas.height - start;
        if (remaining < 12) break; // canvas rounding must not create a blank trailing page
        const height = Math.min(pixelsPerPage, remaining);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = height;
        slice.getContext("2d")?.drawImage(canvas, 0, start, canvas.width, height, 0, 0, canvas.width, height);
        if (index || start) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, (height * 210) / canvas.width);
      }
    } finally {
      frame.remove();
    }
  }
  pdf.save(`${safeName(title)}.pdf`);
}