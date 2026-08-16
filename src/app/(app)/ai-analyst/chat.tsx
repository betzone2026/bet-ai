'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { AppIcon } from '@/components/ui/icon';
import { Badge, DemoBadge, RiskBadge } from '@/components/ui/badge';
import { ProbabilityBar, OutcomeDistribution } from '@/components/ui/probability-bar';
import { ConfidenceMeter } from '@/components/ui/confidence-meter';
import { ErrorState } from '@/components/ui/states';
import { TeamCrest } from '@/components/app/team-crest';
import { DEMO_MATCHES } from '@/lib/demo/matches';
import { getPlan, formatLimit, type PlanId } from '@/lib/config/plans';
import { cn, formatKickoff, pct } from '@/lib/utils';
import type { MatchView } from '@/lib/types/domain';

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

/**
 * A copilot, not a chatbot.
 *
 * Three columns on the desktop: the fixture being discussed, the
 * conversation, and — this is the part a generic chat window lacks — the
 * exact quantitative context the model was handed. The reader can check
 * every figure the analyst cites without leaving the screen, which is what
 * makes the answers auditable rather than merely fluent.
 *
 * On a phone the columns stack in the order they matter: which fixture,
 * then the conversation, then the figures.
 */
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
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_17rem] lg:items-start">
      {/* ---- Fixture picker ------------------------------------------ */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Fixture</CardTitle>
          <DemoBadge />
        </CardHeader>
        <CardBody className="space-y-1.5 p-2">
          {DEMO_MATCHES.map((option) => (
            <FixtureOption
              key={option.id}
              match={option}
              selected={option.id === match.id}
              onSelect={() => {
                if (option.id === match.id) return;
                setMatchId(option.id);
                setMessages([]);
                setError(null);
              }}
            />
          ))}
        </CardBody>
      </Card>

      {/* ---- Conversation ------------------------------------------- */}
      <Card className="flex min-h-[30rem] flex-col lg:min-h-[34rem]">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="truncate">
              {match.homeTeam} vs {match.awayTeam}
            </CardTitle>
            <CardDescription>
              {match.league} · {formatKickoff(match.kickoff)}
            </CardDescription>
          </div>
          <Badge variant="info">{match.modelVersion}</Badge>
        </CardHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="py-6 text-center sm:py-10">
              <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-raised">
                <AppIcon name="analyst" size={20} className="text-alpha" />
              </span>
              <p className="font-display text-h3 font-semibold">
                Ask about {match.homeTeam} vs {match.awayTeam}
              </p>
              <p className="mx-auto mt-1.5 max-w-sm text-small text-muted">
                The analyst reads the figures listed under Context and explains them. Start with one
                of these, or write your own question.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="inline-flex min-h-touch items-center rounded-lg border border-line bg-raised/60 px-3 text-small text-muted transition-colors duration-fast hover:border-line-active hover:text-ink sm:min-h-0 sm:h-8"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <Bubble key={index} message={message} />
          ))}

          {pending && (
            <div className="flex items-center gap-2 text-small text-muted">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-alpha" />
              Reading the model output…
            </div>
          )}

          {error && (
            <ErrorState
              title="The analyst did not answer"
              description={error}
              onRetry={() => setError(null)}
            />
          )}

          <div ref={endRef} />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-line p-3"
        >
          <label className="sr-only" htmlFor="analyst-question">
            Your question about this fixture
          </label>
          <input
            id="analyst-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about this fixture…"
            autoComplete="off"
            className="min-h-touch flex-1 rounded-lg border border-line bg-base px-3 text-small placeholder:text-muted/60 focus:border-alpha sm:min-h-0 sm:h-10"
          />
          <Button
            type="submit"
            icon="send"
            loading={pending}
            disabled={input.trim().length === 0}
            aria-label="Send question"
          >
            <span className="sr-only sm:not-sr-only">Send</span>
          </Button>
        </form>
      </Card>

      {/* ---- Quantitative context ----------------------------------- */}
      <Card className="xl:sticky xl:top-20 lg:col-span-2 xl:col-span-1">
        <CardHeader>
          <CardTitle>Context</CardTitle>
          <CardDescription>What the analyst can see</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
          <section>
            <p className="eyebrow">Model probability</p>
            <ProbabilityBar
              probabilities={match.probabilities}
              size="sm"
              className="mt-2"
              homeLabel={match.homeTeam}
              awayLabel={match.awayTeam}
            />
            <OutcomeDistribution
              probabilities={match.probabilities}
              size="sm"
              className="mt-3"
              homeLabel={match.homeTeam}
              awayLabel={match.awayTeam}
            />
          </section>

          <section className="space-y-4">
            <ConfidenceMeter score={match.confidence} segments={10} />
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Risk</span>
              <RiskBadge score={match.risk} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Monte Carlo</span>
              <span className="font-mono text-fine text-muted">Not run</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Data quality</span>
              <Badge variant="premium">Sample</Badge>
            </div>
          </section>

          <section className="sm:col-span-2 xl:col-span-1">
            <p className="eyebrow">Goals market</p>
            <dl className="tabular mt-2 grid grid-cols-4 gap-2 font-mono text-fine">
              <Figure label="O1.5" value={pct(match.goals.over15, 0)} />
              <Figure label="O2.5" value={pct(match.goals.over25, 0)} />
              <Figure label="O3.5" value={pct(match.goals.over35, 0)} />
              <Figure label="BTTS" value={pct(match.goals.btts, 0)} />
            </dl>
          </section>

          <p className="text-fine leading-relaxed text-muted sm:col-span-2 xl:col-span-1">
            The analyst can only discuss the figures above. It has no access to news, market prices or
            team announcements, and it will say so rather than guess.
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-1">
            <ButtonLink
              href={`/monte-carlo?match=${match.id}`}
              variant="secondary"
              size="sm"
              icon="simulation"
            >
              Simulate
            </ButtonLink>
            <ButtonLink href={`/matches/${match.id}`} variant="ghost" size="sm" icon="forward">
              Full fixture
            </ButtonLink>
          </div>

          <p className="font-mono text-micro text-muted sm:col-span-2 xl:col-span-1">
            {planConfig.name} · {formatLimit(planConfig.limits.aiQueriesDaily)} questions per day
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/** One selectable fixture. A button rather than a `select`, so the league
    and kickoff stay visible while choosing. */
function FixtureOption({
  match,
  selected,
  onSelect,
}: {
  match: MatchView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full min-h-touch items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left',
        // Inset ring: this sits inside a scrolling column, where an
        // outset one would be clipped at the list edges.
        'transition-colors duration-fast focus-visible:outline-offset-[-2px]',
        selected
          ? 'border-alpha/45 bg-alpha/10'
          : 'border-transparent hover:border-line hover:bg-raised/60',
      )}
    >
      <TeamCrest name={match.homeTeam} size={20} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium">
          {match.homeTeam} — {match.awayTeam}
        </span>
        <span className="block truncate font-mono text-micro text-muted">
          {match.league} · {formatKickoff(match.kickoff)}
        </span>
      </span>
      {selected && <AppIcon name="check" size={16} className="shrink-0 text-alpha" />}
    </button>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const user = message.role === 'user';
  return (
    <div className={cn('flex gap-2.5', user ? 'justify-end' : 'justify-start')}>
      {!user && (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-alpha/30 bg-alpha/10">
          <AppIcon name="analyst" size={16} className="text-alpha" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-small leading-relaxed',
          user ? 'bg-raised text-ink' : 'border border-line bg-base text-ink',
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-micro text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
