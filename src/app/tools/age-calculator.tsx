import type { GenerateMetadataFunction } from 'expo-router/server';
import { useState } from 'react';
import { ToolPage } from '@/components/tool-page';
import { Card, Field, Txt } from '@/components/ui';
import { todayIST } from '@/core/jobs';
import { pageMeta } from '@/lib/seo';
import { ageOn, parseIndianDate } from '@/lib/tools/age';

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Age Calculator for Govt Exams', 'Find your exact age in years, months and days on any date — for example the "age as on" date in a recruitment notification.', '/tools/age-calculator');

const toIndian = (iso: string) => iso.split('-').reverse().join('/');

export default function AgeCalculator() {
  const [dob, setDob] = useState('');
  const [on, setOn] = useState(() => toIndian(todayIST()));
  const dobIso = parseIndianDate(dob);
  const onIso = parseIndianDate(on);
  const age = dobIso && onIso ? ageOn(dobIso, onIso) : null;

  return (
    <ToolPage title="Age Calculator" intro="Enter dates as DD/MM/YYYY. Nothing leaves your device.">
      <Field label="Date of birth" placeholder="DD/MM/YYYY" value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" />
      <Field label="Age as on" hint='Use the "age as on" date from the notification.' placeholder="DD/MM/YYYY" value={on} onChangeText={setOn} keyboardType="numbers-and-punctuation" />
      {age ? (
        <Card className="items-center gap-1">
          <Txt variant="muted">Your age</Txt>
          <Txt variant="h1">
            {age.years} years, {age.months} months, {age.days} days
          </Txt>
        </Card>
      ) : dob.length >= 8 ? (
        <Txt variant="muted">Check the dates — date of birth must be a real date before the "as on" date.</Txt>
      ) : null}
    </ToolPage>
  );
}
