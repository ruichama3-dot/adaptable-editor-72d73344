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
  const pageWidth = 794;
  const pageHeight = 1123;
  const pagePadding = 64;
  const contentHeight = pageHeight - pagePadding * 2;
  const scale = 2;
  let renderedPages = 0;

  for (const pageHtml of pages) {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${pageWidth}px;height:${pageHeight}px;border:0;opacity:0;pointer-events:none;`;
    document.body.appendChild(frame);

    try {
      const frameDoc = frame.contentDocument;
      if (!frameDoc) throw new Error("Não foi possível preparar o PDF.");

      frameDoc.open();
      frameDoc.write(`<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body { margin: 0; width: ${pageWidth}px; background: #fff; color: #111; }
body {
  width: ${pageWidth}px;
  min-height: ${pageHeight}px;
  padding: ${pagePadding}px 72px;
  font: 12pt/1.5 "Times New Roman", Times, serif;
  overflow-wrap: anywhere;
  word-break: normal;
}
body, body * { font-family: "Times New Roman", Times, serif !important; }
h1 { margin: 1.2em 0 .6em; font-size: 18pt; font-weight: 700; line-height: 1.2; break-after: avoid; }
h2 { margin: 1.1em 0 .5em; font-size: 15pt; font-weight: 700; line-height: 1.2; break-after: avoid; }
h3 { margin: 1em 0 .4em; font-size: 13pt; font-weight: 700; line-height: 1.2; break-after: avoid; }
p { margin: 0 0 .8em; text-align: justify; overflow-wrap: anywhere; }
ul, ol { margin: 0 0 .8em 1.4em; padding: 0; }
li { margin: 0 0 .25em; }
table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 1em; }
td, th { border: 1px solid #999; padding: 6px 8px; overflow-wrap: anywhere; word-break: break-word; vertical-align: top; }
table.rosto, table.rosto td, table.rosto th { border: 0; background: transparent; vertical-align: top; }
table.rosto td:last-child { text-align: right; }
img, video { display: block; max-width: 100%; height: auto; object-fit: contain; }
figure { max-width: 100%; margin: 1em auto; text-align: center; }
figcaption { margin-top: .4em; font-size: 9pt; text-align: center; }
a { color: inherit; overflow-wrap: anywhere; }
p, li, tr, figure, img { break-inside: avoid; }
.sample-cover, .sample-cover p { text-align: center; }
</style>
</head>
<body>${pageHtml}</body>
</html>`);
      frameDoc.close();

      await Promise.all(Array.from(frameDoc.images).map((image) => image.decode().catch(() => undefined)));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const body = frameDoc.body;
      const contentCanvas = await html2canvas(body, {
        scale,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: pageWidth,
        width: pageWidth,
        height: Math.max(pageHeight, body.scrollHeight),
        logging: false,
      });

      // Cut only at the end of a paragraph/heading/list/table when possible,
      // then restore the same top and bottom page margins on every PDF page.
      const candidates = Array.from(body.querySelectorAll("h1,h2,h3,p,li,table,figure,blockquote"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return Math.round(rect.bottom - body.getBoundingClientRect().top);
        })
        .filter((bottom) => bottom > pagePadding + 24 && bottom < body.scrollHeight - 8)
        .sort((a, b) => a - b);

      let sourceY = 0;
      while (sourceY < contentCanvas.height - 8) {
        const sourceStart = sourceY === 0 ? 0 : sourceY;
        const firstPage = sourceStart === 0;
        const pageCapacity = firstPage ? pageHeight : contentHeight;
        const targetEnd = Math.min(
          contentCanvas.height,
          sourceStart + pageCapacity * scale,
        );
        let sourceEnd = targetEnd;

        if (targetEnd < contentCanvas.height) {
          const targetContentEnd = targetEnd - (pagePadding * scale);
          const safeBoundary = candidates
            .map((value) => value * scale)
            .filter((value) => value > sourceStart + 120 * scale && value <= targetContentEnd)
            .pop();
          if (safeBoundary) sourceEnd = safeBoundary;
        }

        if (sourceEnd <= sourceStart) sourceEnd = Math.min(contentCanvas.height, sourceStart + pageHeight * scale);
        const sliceHeight = sourceEnd - sourceStart;
        const output = document.createElement("canvas");
        output.width = contentCanvas.width;
        output.height = pageHeight * scale;
        const context = output.getContext("2d");
        if (!context) throw new Error("Não foi possível compor uma página do PDF.");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, output.width, output.height);
        const destinationY = sourceStart === 0 ? 0 : pagePadding * scale;
        context.drawImage(
          contentCanvas,
          0, sourceStart, contentCanvas.width, sliceHeight,
          0, destinationY, output.width, Math.min(sliceHeight, output.height - destinationY),
        );

        if (renderedPages > 0) pdf.addPage();
        pdf.addImage(output.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, 210, 297);
        renderedPages += 1;
        sourceY = sourceEnd;
      }
    } finally {
      frame.remove();
    }
  }

  if (!renderedPages) throw new Error("O documento não contém páginas para exportar.");
  pdf.save(`${safeName(title)}.pdf`);
}