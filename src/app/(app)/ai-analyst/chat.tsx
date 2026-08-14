'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProbabilityBar } from '@/components/ui/probability-bar';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Analyze this match.',
  'Why is the home win probability high?',
  'What changes if the main striker does not play?',
  'How much should I trust this confidence score?',
];

export function AnalystChat({ plan, initialMatchId }: { plan: PlanId; initialMatchId?: string }) {
  const planConfig = getPlan(plan);
  const [matchId, setMatchId] = useState(initialMatchId ?? DEMO_MATCHES[0]!.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const match = DEMO_MATCHES.find((m) => m.id === matchId) ?? DEMO_MATCHES[0]!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, question: trimmed }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: '' }));
        throw new Error(body.error || 'The analyst is unavailable.');
      }

      const data = (await response.json()) as { answer: string };
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The analyst is unavailable.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
      {/* Context panel: exactly what the model is allowed to see -------- */}
      <div className="rounded-xl border border-line bg-surface p-4 hairline-top">
        <label className="block">
          <span className="eyebrow">Match</span>
          <select
            value={matchId}
            onChange={(e) => {
              setMatchId(e.target.value);
              setMessages([]);
            }}
            className="mt-1.5 h-10 w-full rounded-lg border border-line bg-base px-3 text-sm focus:border-alpha focus:outline-none"
          >
            {DEMO_MATCHES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeam} vs {m.awayTeam}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5">
          <p className="eyebrow">Context given to the analyst</p>
          <div className="mt-3">
            <ProbabilityBar
              probabilities={match.probabilities}
              size="sm"
              showLabels
              homeLabel={match.homeTeam}
              awayLabel={match.awayTeam}
            />
          </div>
          <dl className="tabular mt-4 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <dt className="text-muted">Confidence</dt>
              <dd>{(match.confidence * 100).toFixed(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Risk</dt>
              <dd>{(match.risk * 100).toFixed(0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Model</dt>
              <dd>{match.modelVersion}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
          The analyst can only discuss the figures listed above. It has no access to news, odds or
          team announcements, and it will say so rather than guess.
        </p>

        <p className="mt-3 font-mono text-[10px] text-muted">
          {planConfig.name} · {formatLimit(planConfig.limits.aiQueriesDaily)} questions per day
        </p>
      </div>

      {/* Conversation --------------------------------------------------- */}
      <div className="flex min-h-[28rem] flex-col rounded-xl border border-line bg-surface hairline-top">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div className="py-8 text-center">
              <p className="font-display text-base font-semibold">
                Ask about {match.homeTeam} vs {match.awayTeam}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
                Start with one of these, or write your own question.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-lg border border-line bg-base px-3 py-1.5 text-xs text-muted hover:border-alpha/40 hover:text-ink"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-raised text-ink'
                    : 'border border-line bg-base text-ink',
                )}
              >
                {message.role === 'assistant' && (
                  <Badge className="mb-2 border-alpha/30 text-alpha">Analyst</Badge>
                )}
                {message.content}
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-alpha" />
              Reading the model output…
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-down/35 bg-down/[0.07] px-3 py-2 text-xs text-down">
              {error}
            </p>
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-line p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this fixture…"
            className="h-10 flex-1 rounded-lg border border-line bg-base px-3 text-sm placeholder:text-muted/60 focus:border-alpha focus:outline-none"
          />
          <Button type="submit" disabled={pending || input.trim().length === 0}>
            <Send className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
