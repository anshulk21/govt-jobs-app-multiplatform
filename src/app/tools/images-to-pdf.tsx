import * as ImagePicker from 'expo-image-picker';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ToolPage } from '@/components/tool-page';
import { Badge, Button, IconButton, Txt } from '@/components/ui';
import { saveAndShare } from '@/lib/files';
import { pageMeta } from '@/lib/seo';
import { toJpeg } from '@/lib/tools/image';
import { base64ToBytes, buildPdf } from '@/lib/tools/pdf';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Images to PDF — Combine Certificates into One PDF', 'Turn photos of your certificates and documents into a single PDF for job applications. Free, works in your browser, nothing is uploaded.', '/tools/images-to-pdf');

export default function ImagesToPdf() {
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsMultipleSelection: true, orderedSelection: true, quality: 1 });
    if (!r.canceled) {
      setImages((prev) => [...prev, ...r.assets]);
      setDone(null);
    }
  };

  const move = (i: number, by: number) =>
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item!);
      return next;
    });

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const pages = [];
      for (const img of images) {
        const jpeg = await toJpeg(img.uri, img);
        pages.push({ bytes: base64ToBytes(jpeg.base64), width: jpeg.width, height: jpeg.height });
      }
      const pdf = buildPdf(pages);
      setDone(`${pages.length} page(s), ${(pdf.length / 1024).toFixed(0)} KB`);
      await saveAndShare({ bytes: pdf, fileName: 'documents.pdf', mimeType: 'application/pdf' });
    } catch (e) {
      setError(`Could not make the PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolPage title="Images to PDF" intro="Add photos of your documents in the order you want, then make one PDF. Everything happens on your device.">
      <Button icon="add-circle-outline" kind="secondary" label="Add images" onPress={() => void pick()} />
      {images.map((img, i) => (
        <View key={`${img.uri}-${i}`} className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <Image source={{ uri: img.uri }} className="h-16 w-12 rounded" resizeMode="cover" accessibilityLabel={`Page ${i + 1}`} />
          <Txt className="flex-1">Page {i + 1}</Txt>
          <IconButton icon="arrow-up" label="Move up" onPress={() => move(i, -1)} disabled={i === 0} />
          <IconButton icon="arrow-down" label="Move down" onPress={() => move(i, 1)} disabled={i === images.length - 1} />
          <IconButton icon="trash-outline" label="Remove" onPress={() => setImages((p) => p.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button icon="document-outline" label={busy ? 'Making PDF…' : 'Make PDF'} disabled={!images.length || busy} onPress={() => void make()} />
      {done ? <Badge tone="green">{done}</Badge> : null}
      {error ? <Txt className="text-red-700 dark:text-red-300">{error}</Txt> : null}
    </ToolPage>
  );
}
