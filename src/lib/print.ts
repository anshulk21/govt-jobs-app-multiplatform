// Apps: turn HTML into a PDF file and open the share sheet.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export async function sharePdf(html: string, fileTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileTitle, UTI: 'com.adobe.pdf' });
}
