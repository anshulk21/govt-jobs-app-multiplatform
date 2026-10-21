import { Stack, useLocalSearchParams } from 'expo-router';
import type { GenerateMetadataFunction, LoaderFunction } from 'expo-router/server';
import { Platform } from 'react-native';
import { ProGate } from '@/components/monetization';
import { QuizPlayer } from '@/components/quiz-player';
import { Loading, Message, Screen, Txt } from '@/components/ui';
import { apiPaths } from '@/core/api';
import type { Quiz } from '@/core/types';
import { useRouteData } from '@/lib/route-data';
import { pageMeta } from '@/lib/seo';
import { useMounted } from '@/lib/use-today';
import { quizzes } from '@/server/data';

export async function generateStaticParams() {
  return quizzes().map((q) => ({ id: q.id }));
}

export const loader: LoaderFunction<Quiz | null> = (_req, params) => quizzes().find((q) => q.id === params.id) ?? null;

export const generateMetadata: GenerateMetadataFunction = (_req, params) => {
  const q = quizzes().find((x) => x.id === params.id);
  return q ? pageMeta(`${q.title} — Mock Test`, `Practice test for ${q.exams}: ${q.questions.length} questions with answers.`, `/quiz/${q.id}`) : null;
};

export default function QuizPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useRouteData<Quiz>(apiPaths.quiz(id));
  const mounted = useMounted();
  const quiz = res.data;
  if (!quiz) return <Screen>{res.loading ? <Loading /> : <Message text="This test could not be found." />}</Screen>;
  return (
    <Screen>
      {Platform.OS !== 'web' ? <Stack.Screen options={{ title: quiz.title }} /> : null}
      <Txt variant="h1">{quiz.title}</Txt>
      <Txt variant="muted">
        For {quiz.exams} · {quiz.questions.length} questions{quiz.sample ? ' · sample questions' : ''}
      </Txt>
      {quiz.description ? <Txt>{quiz.description}</Txt> : null}
      {mounted ? (
        <ProGate feature="The full mock test">
          <QuizPlayer questions={quiz.questions} name={quiz.id} />
        </ProGate>
      ) : null}
    </Screen>
  );
}
