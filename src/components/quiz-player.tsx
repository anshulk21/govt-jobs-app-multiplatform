import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { score } from '@/core/quiz';
import type { QuizQuestion } from '@/core/types';
import { track } from '@/lib/analytics';
import { Badge, Button, Card, Txt } from './ui';

/** Answers one question at a time, shows the correct answer and explanation, then the score. */
export function QuizPlayer({ questions, name }: { questions: QuizQuestion[]; name: string }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [i, setI] = useState(0);
  const done = i >= questions.length;
  if (done) {
    const s = score(questions, answers);
    return (
      <Card className="items-center gap-3">
        <Txt variant="h2">
          You scored {s.correct} / {s.total}
        </Txt>
        <Button kind="secondary" label="Try again" onPress={() => (setAnswers(questions.map(() => null)), setI(0))} />
      </Card>
    );
  }
  const q = questions[i]!;
  const chosen = answers[i];
  const answered = chosen !== null && chosen !== undefined;
  return (
    <Card className="gap-3">
      <Txt variant="small">
        Question {i + 1} of {questions.length}
      </Txt>
      <Txt variant="label">{q.q}</Txt>
      <View className="gap-2">
        {q.options.map((opt, k) => {
          const correct = answered && k === q.answer;
          const wrong = answered && k === chosen && k !== q.answer;
          return (
            <Pressable
              key={k}
              disabled={answered}
              onPress={() => setAnswers((a) => a.map((v, j) => (j === i ? k : v)))}
              role="button"
              className={`rounded-xl border px-3 py-3 ${
                correct ? 'border-green-600 bg-green-50 dark:bg-green-950' : wrong ? 'border-red-600 bg-red-50 dark:bg-red-950' : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <Txt>{opt}</Txt>
            </Pressable>
          );
        })}
      </View>
      {answered ? (
        <>
          <Badge tone={chosen === q.answer ? 'green' : 'red'}>{chosen === q.answer ? 'Correct' : `Answer: ${q.options[q.answer]}`}</Badge>
          {q.explanation ? <Txt variant="muted">{q.explanation}</Txt> : null}
          <Button
            label={i + 1 < questions.length ? 'Next question' : 'See score'}
            onPress={() => {
              if (i + 1 >= questions.length) track('quiz_complete', { quiz: name, correct: score(questions, answers).correct });
              setI(i + 1);
            }}
          />
        </>
      ) : null}
    </Card>
  );
}
