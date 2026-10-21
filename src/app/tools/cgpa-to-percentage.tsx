import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { ToolPage } from '@/components/tool-page';
import { Card, Chip, ChipRow, Field, Txt } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import { CGPA_FORMULAS, cgpaToPercent, type CgpaFormulaId } from '@/lib/tools/cgpa';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('CGPA to Percentage Converter', 'Convert CGPA to percentage using CBSE (×9.5), ×10, (CGPA−0.75)×10, 4-point or your university’s own formula.', '/tools/cgpa-to-percentage');

export default function CgpaTool() {
  const [cgpa, setCgpa] = useState('');
  const [formula, setFormula] = useState<CgpaFormulaId | 'custom'>('cbse');
  const [factor, setFactor] = useState('');
  const pct = cgpa ? cgpaToPercent(Number(cgpa), formula, Number(factor)) : null;

  return (
    <ToolPage title="CGPA to Percentage" intro="Use the formula printed on your marksheet or asked for in the notification. Boards and universities differ.">
      <Field label="Your CGPA" placeholder="e.g. 8.4" value={cgpa} onChangeText={setCgpa} keyboardType="decimal-pad" />
      <Txt variant="label">Formula</Txt>
      <ChipRow>
        {CGPA_FORMULAS.map((f) => (
          <Chip key={f.id} label={f.label} selected={formula === f.id} onPress={() => setFormula(f.id)} />
        ))}
        <Chip label="Custom multiplier" selected={formula === 'custom'} onPress={() => setFormula('custom')} />
      </ChipRow>
      {formula === 'custom' ? <Field label="Multiply CGPA by" placeholder="e.g. 9.25" value={factor} onChangeText={setFactor} keyboardType="decimal-pad" /> : null}
      {pct !== null ? (
        <Card className="items-center gap-1">
          <Txt variant="muted">Percentage</Txt>
          <Txt variant="h1">{pct}%</Txt>
        </Card>
      ) : cgpa ? (
        <Txt variant="muted">Enter a CGPA within the scale of the chosen formula.</Txt>
      ) : null}
    </ToolPage>
  );
}
