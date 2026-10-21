// Website: open the summary in the print dialog ("Save as PDF").
export async function sharePdf(html: string, _fileTitle: string): Promise<void> {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Allow pop-ups to save the PDF.');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
