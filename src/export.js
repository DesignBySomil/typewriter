/**
 * Renders the full typed sheet (all lines, top-aligned, with archival 80gsm bond paper tone,
 * cotton fiber texture, yellowed vintage edges, and absorbed black/red ink) onto an offscreen
 * 2x US Letter / A4 aspect ratio canvas, and exports as PNG, single-page PDF (pure JS), or Print.
 */
export function createExportSystem(paperSys) {
  const PAGE_W = 1650; // 2x US Letter / A4 width
  const PAGE_H = 2200; // 2x US Letter / A4 height

  function renderFullPageCanvas() {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = PAGE_W;
    outCanvas.height = PAGE_H;
    const ctx = outCanvas.getContext('2d');

    // 1. Warm 80gsm archival bond paper base + subtle yellowed edge vignette
    ctx.fillStyle = '#f1e9d9';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    const edgeGrad = ctx.createRadialGradient(
      PAGE_W * 0.5, PAGE_H * 0.5, PAGE_W * 0.28,
      PAGE_W * 0.5, PAGE_H * 0.5, PAGE_H * 0.65
    );
    edgeGrad.addColorStop(0.0, 'rgba(241, 233, 217, 0.0)');
    edgeGrad.addColorStop(0.75, 'rgba(225, 212, 186, 0.35)');
    edgeGrad.addColorStop(1.0, 'rgba(210, 194, 162, 0.68)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // 2. Subtle cotton fiber & laid paper grain across the sheet
    const pageImg = ctx.getImageData(0, 0, PAGE_W, PAGE_H);
    const pData = pageImg.data;
    for (let i = 0; i < pData.length; i += 4) {
      const pIdx = i >> 2;
      const x = pIdx % PAGE_W;
      const y = (pIdx / PAGE_W) | 0;
      const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 5.0 - 2.5;
      pData[i]     = Math.min(255, Math.max(0, pData[i] + grain));
      pData[i + 1] = Math.min(255, Math.max(0, pData[i + 1] + grain));
      pData[i + 2] = Math.min(255, Math.max(0, pData[i + 2] + grain));
    }

    // 3. Composite the typed ink from the paper source canvas (R = black ink, G = red ink, B = deboss)
    const srcCanvas = paperSys.getExportSourceCanvas();
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = PAGE_W;
    tmpCanvas.height = PAGE_H;
    const tmpCtx = tmpCanvas.getContext('2d');

    // Draw the 2048x2048 text canvas top-aligned with clean page margins
    const marginX = 95;
    const marginY = 70;
    const drawW = PAGE_W - marginX * 2;
    const drawH = drawW;
    tmpCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, marginX, marginY, drawW, drawH);

    const inkData = tmpCtx.getImageData(0, 0, PAGE_W, PAGE_H).data;
    for (let i = 0; i < inkData.length; i += 4) {
      const rInk = inkData[i] / 255;
      const gInk = inkData[i + 1] / 255;
      const bDeboss = inkData[i + 2] / 255;
      const totalInk = Math.min(1.0, rInk + gInk);

      if (totalInk > 0.02) {
        const redRatio = gInk / Math.max(0.001, rInk + gInk);
        // Carbon black vs Bichrome crimson ink target RGB
        const targetR = 24 * (1 - redRatio) + 148 * redRatio;
        const targetG = 22 * (1 - redRatio) + 32 * redRatio;
        const targetB = 24 * (1 - redRatio) + 26 * redRatio;
        const alpha = Math.min(0.94, Math.pow(totalInk, 0.82));

        pData[i]     = pData[i]     * (1 - alpha) + targetR * alpha;
        pData[i + 1] = pData[i + 1] * (1 - alpha) + targetG * alpha;
        pData[i + 2] = pData[i + 2] * (1 - alpha) + targetB * alpha;
      } else if (bDeboss > 0.05) {
        // Stencil mode blind deboss shading
        const shade = 1.0 - bDeboss * 0.08;
        pData[i]     *= shade;
        pData[i + 1] *= shade;
        pData[i + 2] *= shade;
      }
    }

    ctx.putImageData(pageImg, 0, 0);
    return outCanvas;
  }

  function downloadPNG() {
    const canvas = renderFullPageCanvas();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'typewriter-page.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }

  /**
   * Builds a valid single-page PDF 1.4 binary in plain JS embedding the JPEG page image
   */
  function downloadPDF() {
    const canvas = renderFullPageCanvas();
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = jpegDataUrl.split(',')[1];
    const binStr = atob(base64);
    const imgBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      imgBytes[i] = binStr.charCodeAt(i);
    }

    const pdfW = 612; // US Letter 8.5" * 72pt
    const pdfH = 792; // US Letter 11" * 72pt
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let byteOffset = 0;

    function pushStr(str) {
      const bytes = encoder.encode(str);
      chunks.push(bytes);
      byteOffset += bytes.length;
    }

    function pushBytes(bytes) {
      chunks.push(bytes);
      byteOffset += bytes.length;
    }

    pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    // 1: Catalog
    offsets[1] = byteOffset;
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // 2: Pages
    offsets[2] = byteOffset;
    pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    // 3: Page
    offsets[3] = byteOffset;
    pushStr(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    );

    // 4: Image XObject (DCTDecode JPEG)
    offsets[4] = byteOffset;
    pushStr(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
    );
    pushBytes(imgBytes);
    pushStr('\nendstream\nendobj\n');

    // 5: Page Content Stream
    const contentStream = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
    offsets[5] = byteOffset;
    pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // Xref Table
    const xrefOffset = byteOffset;
    pushStr('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 1; i <= 5; i++) {
      pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }

    pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const pdfBlob = new Blob(chunks, { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'typewriter-page.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function printPage() {
    const canvas = renderFullPageCanvas();
    const dataUrl = canvas.toDataURL('image/png');

    let iframe = document.getElementById('typewriter-print-iframe');
    if (iframe) iframe.remove();

    iframe = document.createElement('iframe');
    iframe.id = 'typewriter-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
      <html>
      <head>
        <title>Typewriter Page</title>
        <style>
          @page { margin: 0; size: auto; }
          html, body { margin: 0; padding: 0; background: #fff; }
          img { display: block; width: 100%; height: auto; page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <img id="p-img" src="${dataUrl}" />
        <script>
          const img = document.getElementById('p-img');
          img.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 80);
          };
        <\/script>
      </body>
      </html>`);
    doc.close();
  }

  return {
    renderFullPageCanvas,
    downloadPNG,
    downloadPDF,
    printPage
  };
}
