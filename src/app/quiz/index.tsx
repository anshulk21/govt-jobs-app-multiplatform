import { Stack } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { useMemo } from 'react';
import { Platform, View } from 'react-native';
import { QuizPlayer } from '@/components/quiz-player';
import { LinkRow, Loading, Message, Screen, Txt } from '@/components/ui';
import { MONETIZATION } from '@/config/monetization';
import { apiPaths } from '@/core/api';
import { dailyQuestions } from '@/core/quiz';
import type { Quiz } from '@/core/types';
import { useApi } from '@/lib/api';
import { useRouteData } from '@/lib/route-data';
import { pageMeta } from '@/lib/seo';
import { useMounted, useToday } from '@/lib/use-today';
import { quizzes } from '@/server/data';

interface QuizIndex {
  generatedAt: string;
  quizzes: (Omit<Quiz, 'questions'> & { count: number })[];
}

export const loader: LoaderFunction<QuizIndex> = () => ({
  generatedAt: new Date().toISOString(),
  quizzes: quizzes().map(({ questions, ...q }) => ({ ...q, count: questions.length })),
});

export const generateMetadata: GenerateMetadataFunction = () =>
  pageMeta('Free Daily Quiz & Mock Tests for Govt Exams', 'Free daily practice quiz and mock tests for SSC, Railway, Police and other government exams.', '/quiz');

function DailyQuiz({ ids }: { ids: string[] }) {
  // The daily quiz mixes questions from the first two practice sets (fetched on the device).
  const first = useApi<Quiz>(ids[0] ? apiPaths.quiz(ids[0]) : null);
  const second = useApi<Quiz>(ids[1] ? apiPaths.quiz(ids[1]) : null);
  const today = useToday();
  const all = [...(first.data?.questions ?? []), ...(second.data?.questions ?? [])];
  const qs = useMemo(() => dailyQuestions(all, today, MONETIZATION.quiz.dailyQuestions), [all.length, today]); // eslint-disable-line react-hooks/exhaustive-deps
  if (first.loading && !all.length) return <Loading />;
  if (!qs.length) return null;
  return <QuizPlayer key={today} questions={qs} name={`daily-${today}`} />;
}

export default function QuizIndexPage() {
  const res = useRouteData<QuizIndex>(apiPaths.quizzes);
  const mounted = useMounted();
  const list = res.data?.quizzes ?? [];
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: 'Mock tests' }} /> : null}
      <Txt variant="h1">Daily Quiz & Mock Tests</Txt>
      <Txt variant="muted">A free quiz every day, plus full practice sets for government exams.</Txt>
      {!MONETIZATION.quiz.enabled ? <Message text="Mock tests are coming soon." /> : null}
      {list.length ? (
        // The quiz loads on the device; its space is reserved in the page so nothing jumps.
        <View className="min-h-[440px] gap-2">
          <Txt variant="h2">Today's free quiz</Txt>
          {mounted ? <DailyQuiz ids={list.map((q) => q.id)} /> : <Loading />}
        </View>
      ) : null}
      {list.length ? (
        <View className="gap-1">
          <Txt variant="h2">Full mock tests</Txt>
          {list.map((q) => (
            <LinkRow key={q.id} href={`/quiz/${q.id}`} icon="school-outline" label={q.title} description={`${q.exams} · ${q.count} questions${q.sample ? ' · sample' : ''}`} />
          ))}
        </View>
      ) : res.loading ? (
        <Loading />
      ) : null}
    </Screen>
  );
}
