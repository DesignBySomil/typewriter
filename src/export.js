// Print / Save: renders the typed page flat, exactly as the paper looks
// (warm bond stock, fibre grain, soft ink bleed, black + red ribbon), then
// exports PNG, PDF or sends it to the browser print dialog.

const PAGE_W = 2048;
const PAGE_H = 2650; // 8.5 x 11 in proportion

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function renderPageCanvas(paperCanvas) {
  const out = document.createElement('canvas');
  out.width = PAGE_W;
  out.height = PAGE_H;
  const ctx = out.getContext('2d');
  const rand = rng(44);

  const ink = paperCanvas.getContext('2d').getImageData(0, 0, paperCanvas.width, paperCanvas.height);
  const img = ctx.createImageData(PAGE_W, PAGE_H);
  const d = img.data;
  const src = ink.data;
  const sw = paperCanvas.width;
  const sh = paperCanvas.height;

  // low-frequency mottling grid
  const gw = 24, gh = 31;
  const grid = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand() - 0.5;
  const mottle = (x, y) => {
    const fx = (x / PAGE_W) * gw, fy = (y / PAGE_H) * gh;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const a = grid[iy * (gw + 1) + ix], b = grid[iy * (gw + 1) + ix + 1];
    const c = grid[(iy + 1) * (gw + 1) + ix], e = grid[(iy + 1) * (gw + 1) + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + e * tx) * ty;
  };

  for (let y = 0; y < PAGE_H; y++) {
    for (let x = 0; x < PAGE_W; x++) {
      const o = (y * PAGE_W + x) * 4;
      const fib = (rand() - 0.5) * 0.045 + mottle(x, y) * 0.03;
      let r = 0.946 + fib, g = 0.916 + fib, b = 0.852 + fib;

      // slightly warmer edges
      const edge = Math.min(x, PAGE_W - 1 - x, y, PAGE_H - 1 - y) / 120;
      const warm = Math.max(0, 1 - edge) * 0.35;
      r -= warm * 0.08; g -= warm * 0.11; b -= warm * 0.17;

      if (y < sh) {
        const si = (y * sw + x) * 4;
        const kBlack = src[si] / 255;
        const kRed = src[si + 1] / 255;
        const sm = (t) => { t = Math.min(1, Math.max(0, (t - 0.08) / 0.62)); return t * t * (3 - 2 * t); };
        const kb = sm(kBlack) * (0.9 + (rand() - 0.5) * 0.1);
        const kr = sm(kRed) * (0.9 + (rand() - 0.5) * 0.1);
        // black ribbon: soft near-black with a faint warm tint
        r = r * (1 - kb) + 0.105 * kb;
        g = g * (1 - kb) + 0.098 * kb;
        b = b * (1 - kb) + 0.092 * kb;
        // red ribbon
        r = r * (1 - kr) + 0.66 * kr;
        g = g * (1 - kr) + 0.14 * kr;
        b = b * (1 - kr) + 0.13 * kr;
      }
      d[o] = Math.max(0, Math.min(255, r * 255));
      d[o + 1] = Math.max(0, Math.min(255, g * 255));
      d[o + 2] = Math.max(0, Math.min(255, b * 255));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function pdfFromJpeg(jpegBytes, pxW, pxH) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let len = 0;
  const push = (data) => {
    const u = typeof data === 'string' ? enc.encode(data) : data;
    parts.push(u);
    len += u.length;
  };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };

  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const content = 'q 612 0 0 792 0 0 cm /Im0 Do Q';
  obj(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets[5] = len;
  push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  push('\nendstream\nendobj\n');
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

export function createExportSystem(paperCanvas) {
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  function savePNG() {
    const page = renderPageCanvas(paperCanvas);
    page.toBlob((b) => b && download(b, `typewriter-page-${stamp()}.png`), 'image/png');
  }

  function makePDFBlob() {
    const page = renderPageCanvas(paperCanvas);
    return new Promise((resolve, reject) => {
      page.toBlob(async (b) => {
        if (!b) return reject(new Error('render failed'));
        const bytes = new Uint8Array(await b.arrayBuffer());
        resolve(pdfFromJpeg(bytes, PAGE_W, PAGE_H));
      }, 'image/jpeg', 0.95);
    });
  }

  async function savePDF() {
    download(await makePDFBlob(), `typewriter-page-${stamp()}.pdf`);
  }

  function printPage() {
    const page = renderPageCanvas(paperCanvas);
    const url = page.toDataURL('image/png');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><title>Typewriter page</title><style>@page{size:letter;margin:0}html,body{margin:0}img{display:block;width:100%;height:auto}</style></head><body><img id="p" src="${url}"></body></html>`);
    doc.close();
    const go = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60000);
    };
    const im = doc.getElementById('p');
    if (im.complete) go(); else im.onload = go;
  }

  return { savePNG, savePDF, makePDFBlob, printPage, renderPageCanvas: () => renderPageCanvas(paperCanvas) };
}
