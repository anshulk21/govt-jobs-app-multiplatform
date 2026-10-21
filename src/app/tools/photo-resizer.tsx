import * as ImagePicker from 'expo-image-picker';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ToolPage } from '@/components/tool-page';
import { Badge, Button, Card, Chip, ChipRow, Field, Txt } from '@/components/ui';
import { saveAndShare } from '@/lib/files';
import { pageMeta } from '@/lib/seo';
import { resizeToFit, type Processed } from '@/lib/tools/image';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Photo & Signature Resizer for Govt Forms (KB & Pixels)', 'Resize your photo or signature to the exact pixel size and file size (KB) required in SSC, IBPS, railway and state job forms. Runs in your browser.', '/tools/photo-resizer');

// Common sizes; every notification lists its own — always check.
const PRESETS = [
  { id: 'photo', label: 'Photo 200×230 px, ≤50 KB', width: 200, height: 230, maxKB: 50 },
  { id: 'sign', label: 'Signature 140×60 px, ≤20 KB', width: 140, height: 60, maxKB: 20 },
  { id: 'thumb', label: 'Thumb impression 240×240 px, ≤50 KB', width: 240, height: 240, maxKB: 50 },
];

export default function PhotoResizer() {
  const [source, setSource] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [width, setWidth] = useState('200');
  const [height, setHeight] = useState('230');
  const [maxKB, setMaxKB] = useState('50');
  const [minKB, setMinKB] = useState('');
  const [result, setResult] = useState<Processed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
    if (!r.canceled && r.assets[0]) {
      setSource(r.assets[0]);
      setResult(null);
      setError(null);
    }
  };

  const run = async () => {
    if (!source) return;
    setBusy(true);
    setError(null);
    try {
      const out = await resizeToFit(source.uri, source, { width: Number(width), height: Number(height), maxKB: Number(maxKB) });
      if (!out) setError(`Could not get under ${maxKB} KB at this size. Try smaller dimensions.`);
      else if (minKB && out.bytes < Number(minKB) * 1024) setError(`The result is ${(out.bytes / 1024).toFixed(1)} KB, below the minimum ${minKB} KB. Try larger dimensions.`);
      setResult(out);
    } catch (e) {
      setError(`Could not process the image: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolPage title="Photo & Signature Resizer" intro="Pick an image, choose the size from your notification, and save. Your photo never leaves your device.">
      <Button icon="image-outline" label={source ? 'Choose another image' : 'Choose image'} onPress={() => void pick()} />
      {source ? <Image source={{ uri: source.uri }} className="h-40 w-full rounded-xl" resizeMode="contain" accessibilityLabel="Selected image" /> : null}

      <Txt variant="label">Size</Txt>
      <ChipRow>
        {PRESETS.map((p) => (
          <Chip key={p.id} label={p.label} selected={width === String(p.width) && height === String(p.height) && maxKB === String(p.maxKB)} onPress={() => (setWidth(String(p.width)), setHeight(String(p.height)), setMaxKB(String(p.maxKB)))} />
        ))}
      </ChipRow>
      <View className="flex-row gap-3">
        <View className="flex-1"><Field label="Width (px)" value={width} onChangeText={setWidth} keyboardType="number-pad" /></View>
        <View className="flex-1"><Field label="Height (px)" value={height} onChangeText={setHeight} keyboardType="number-pad" /></View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1"><Field label="Max size (KB)" value={maxKB} onChangeText={setMaxKB} keyboardType="number-pad" /></View>
        <View className="flex-1"><Field label="Min size (KB)" placeholder="optional" value={minKB} onChangeText={setMinKB} keyboardType="number-pad" /></View>
      </View>
      <Button icon="resize-outline" label={busy ? 'Working…' : 'Resize'} disabled={!source || busy || !width || !height || !maxKB} onPress={() => void run()} />

      {error ? <Txt className="text-red-700 dark:text-red-300">{error}</Txt> : null}
      {result ? (
        <Card className="items-center gap-3">
          <Image source={{ uri: result.uri }} style={{ width: result.width, height: result.height, maxWidth: '100%' }} resizeMode="contain" accessibilityLabel="Resized image" />
          <Badge tone="green">
            {result.width}×{result.height} px · {(result.bytes / 1024).toFixed(1)} KB
          </Badge>
          <Button icon="download-outline" label="Save / Share" onPress={() => void saveAndShare({ uri: result.uri, fileName: `resized-${result.width}x${result.height}.jpg`, mimeType: 'image/jpeg' })} />
        </Card>
      ) : null}
    </ToolPage>
  );
}
