// Apps: save a generated file to the cache and open the share sheet (WhatsApp, Drive, Files…).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function saveAndShare(opts: { fileName: string; mimeType: string; bytes?: Uint8Array; uri?: string }): Promise<void> {
  let uri = opts.uri;
  if (opts.bytes) {
    const file = new File(Paths.cache, opts.fileName);
    if (file.exists) file.delete();
    await file.write(opts.bytes);
    uri = file.uri;
  }
  if (!uri) throw new Error('Nothing to save');
  await Sharing.shareAsync(uri, { mimeType: opts.mimeType, dialogTitle: opts.fileName });
}
