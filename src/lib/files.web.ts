// Website: download the generated file.
export async function saveAndShare(opts: { fileName: string; mimeType: string; bytes?: Uint8Array; uri?: string }): Promise<void> {
  const href = opts.bytes ? URL.createObjectURL(new Blob([opts.bytes as BlobPart], { type: opts.mimeType })) : opts.uri;
  if (!href) throw new Error('Nothing to save');
  const a = document.createElement('a');
  a.href = href;
  a.download = opts.fileName;
  a.click();
  if (opts.bytes) setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
