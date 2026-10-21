import { Link, Stack } from 'expo-router';
import type { GenerateMetadataFunction } from 'expo-router/server';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { ProGate } from '@/components/monetization';
import { Badge, Card, Loading, Message, Screen, Txt } from '@/components/ui';
import { apiPaths } from '@/core/api';
import { calendarByMonth, KIND_LABEL } from '@/core/calendar';
import { formatDate } from '@/core/jobs';
import type { JobListPayload } from '@/core/types';
import { useApi } from '@/lib/api';
import { pageMeta } from '@/lib/seo';
import { useMounted, useToday } from '@/lib/use-today';

export const generateMetadata: GenerateMetadataFunction = () => ({
  ...pageMeta('Exam Calendar', 'Upcoming last dates, exam dates and application start dates for government jobs.', '/calendar'),
  robots: { index: false },
});

export default function CalendarPage() {
  const mounted = useMounted();
  const res = useApi<JobListPayload>(apiPaths.latest);
  const today = useToday(res.data?.generatedAt);
  const months = useMemo(() => (res.data ? calendarByMonth(res.data.jobs, today) : []), [res.data, today]);
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Exam calendar' }} /> : null}
      <Txt variant="h1">Exam calendar</Txt>
      <Txt variant="muted">Last dates, exam dates and application start dates of published jobs. Always confirm in the official notification.</Txt>
      {!mounted ? null : (
        <ProGate feature="The exam calendar">
          {!res.data ? (
            res.loading ? <Loading /> : <Message text="Could not load. Check your internet connection." />
          ) : months.length === 0 ? (
            <Message icon="calendar-outline" text="No upcoming dates yet." />
          ) : (
            months.map((m) => (
              <View key={m.month} className="gap-2">
                <Txt variant="h2">{m.month}</Txt>
                <Card>
                  {m.events.map((e) => (
                    <Link key={`${e.job.slug}-${e.kind}`} href={`/jobs/${e.job.slug}`} className="border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800">
                      <View className="flex-row items-start gap-3">
                        <Txt variant="label" className="w-20">
                          {formatDate(e.date)!.replace(/ \d{4}$/, '')}
                        </Txt>
                        <View className="flex-1 gap-1">
                          <Txt numberOfLines={2}>{e.job.title}</Txt>
                          <Badge tone={e.kind === 'last-date' ? 'red' : e.kind === 'exam' ? 'brand' : 'green'}>{KIND_LABEL[e.kind]}</Badge>
                        </View>
                      </View>
                    </Link>
                  ))}
                </Card>
              </View>
            ))
          )}
        </ProGate>
      )}
    </Screen>
  );
}
