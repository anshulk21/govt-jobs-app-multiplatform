import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFParse } from 'pdf-parse';

const run = promisify(execFile);

/** Plain text of the first `maxPages` pages. Scanned (image-only) PDFs give empty text. */
export async function pdfToText(bytes: Uint8Array, maxPages: number): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText({ first: maxPages });
    return { text: result.text, pages: result.total };
  } finally {
    await parser.destroy();
  }
}

let ocrLanguages: Promise<string | null> | undefined;

/** "eng+hin" (or "eng") when tesseract and pdftoppm are installed, else null. Checked once per run. */
function ocrLanguage(): Promise<string | null> {
  ocrLanguages ??= Promise.all([run('tesseract', ['--list-langs']), run('pdftoppm', ['-v'])])
    .then(([langs]) => {
      const have = new Set(`${langs.stdout}\n${langs.stderr}`.split(/\s+/));
      return have.has('eng') ? (have.has('hin') ? 'eng+hin' : 'eng') : null;
    })
    .catch(() => null);
  return ocrLanguages;
}

/**
 * Text of a scanned PDF's first `maxPages` pages by OCR (poppler's pdftoppm + tesseract, free).
 * Null when those tools aren't installed: the monitor workflow installs them on GitHub's servers.
 */
export async function ocrPdf(bytes: Uint8Array, maxPages: number): Promise<string | null> {
  const lang = await ocrLanguage();
  if (!lang) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
  try {
    const pdf = path.join(dir, 'notice.pdf');
    fs.writeFileSync(pdf, bytes);
    await run('pdftoppm', ['-r', '200', '-gray', '-png', '-l', String(maxPages), pdf, path.join(dir, 'page')], { timeout: 60_000 });
    const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
    const texts: string[] = [];
    for (const page of pages) {
      const { stdout } = await run('tesseract', [path.join(dir, page), 'stdout', '-l', lang], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
      texts.push(stdout);
    }
    return texts.join('\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
