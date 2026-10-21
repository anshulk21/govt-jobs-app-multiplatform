import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { View } from 'react-native';
import { ToolPage } from '@/components/tool-page';
import { Badge, Card, Chip, ChipRow, Field, Txt } from '@/components/ui';
import { pageMeta } from '@/lib/seo';
import { RELAXATION_PRESETS, checkEligibility, parseIndianDate } from '@/lib/tools/age';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Age Eligibility Calculator with Category Relaxation', 'Check if you are within the age limit for a government job, including OBC, SC/ST and PwBD relaxation.', '/tools/age-eligibility');

export default function AgeEligibility() {
  const [dob, setDob] = useState('');
  const [cutoff, setCutoff] = useState('');
  const [min, setMin] = useState('18');
  const [max, setMax] = useState('25');
  const [preset, setPreset] = useState<string>('gen');
  const [relax, setRelax] = useState('0');

  const dobIso = parseIndianDate(dob);
  const cutoffIso = parseIndianDate(cutoff);
  const result =
    dobIso && cutoffIso && min && max
      ? checkEligibility({ dob: dobIso, cutoff: cutoffIso, minAge: Number(min), maxAge: Number(max), relaxationYears: Number(relax) || 0 })
      : null;

  return (
    <ToolPage
      title="Age Eligibility"
      intro="Copy the age limits and the “age as on” date from the notification. Relaxation values below are common central government rules — always check the notification, states differ."
    >
      <Field label="Date of birth" placeholder="DD/MM/YYYY" value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" />
      <Field label="Age as on (from notification)" placeholder="DD/MM/YYYY" value={cutoff} onChangeText={setCutoff} keyboardType="numbers-and-punctuation" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Minimum age" value={min} onChangeText={setMin} keyboardType="number-pad" />
        </View>
        <View className="flex-1">
          <Field label="Maximum age" value={max} onChangeText={setMax} keyboardType="number-pad" />
        </View>
      </View>
      <Txt variant="label">Category</Txt>
      <ChipRow>
        {RELAXATION_PRESETS.map((p) => (
          <Chip key={p.id} label={`${p.label} (+${p.years})`} selected={preset === p.id} onPress={() => (setPreset(p.id), setRelax(String(p.years)))} />
        ))}
      </ChipRow>
      <Field label="Relaxation (years)" hint="Change this if your notification says something different (ex-servicemen, widows, state domicile…)." value={relax} onChangeText={(v) => (setRelax(v), setPreset(''))} keyboardType="number-pad" />

      {result ? (
        <Card className="gap-2">
          <Badge tone={result.eligible ? 'green' : 'red'}>{result.eligible ? 'Eligible by age' : 'Not eligible by age'}</Badge>
          <Txt variant="h2">
            Age on cutoff: {result.age.years} years, {result.age.months} months, {result.age.days} days
          </Txt>
          <Txt>
            Allowed: {min}–{result.maxAllowed} years{Number(relax) ? ` (including ${relax} years relaxation)` : ''}.
            {result.reason === 'too-young' ? ' You are below the minimum age.' : result.reason === 'too-old' ? ' You have crossed the upper age limit.' : ''}
          </Txt>
          <Txt variant="small">This is a guide only. The notification’s rules decide eligibility.</Txt>
        </Card>
      ) : null}
    </ToolPage>
  );
}
