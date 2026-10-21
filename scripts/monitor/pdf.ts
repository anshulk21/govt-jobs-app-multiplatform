import { PDFParse } from 'pdf-parse';

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
