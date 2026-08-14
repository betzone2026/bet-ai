/**
 * How it works. The stages are genuinely sequential — each one consumes
 * the previous one's output — so they are numbered, and the connector
 * runs through them as a single spine rather than six detached cards.
 */
const STAGES = [
  {
    id: '01',
    title: 'Sports data',
    body: 'Fixtures, results, expected goals and squad availability, normalised into one schema.',
  },
  {
    id: '02',
    title: 'Statistical models',
    body: 'Poisson and Dixon-Coles scoring rates, Elo strength ratings and rolling form indices.',
  },
  {
    id: '03',
    title: 'Monte Carlo',
    body: 'Up to 500,000 simulated match paths per fixture, producing a full outcome distribution.',
  },
  {
    id: '04',
    title: 'Probability engine',
    body: 'Model outputs are combined, validated and normalised into a single calibrated set.',
  },
  {
    id: '05',
    title: 'Market analysis',
    body: 'Model probabilities are compared against market-implied ones to size the difference.',
  },
  {
    id: '06',
    title: 'AI explanation',
    body: 'The analyst reads the computed figures back in plain language. It never invents them.',
  },
];

export function Pipeline() {
  return (
    <section id="analytics" className="border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-shell px-5 lg:px-8">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Six stages, one direction
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          SportAlpha AI uses quantitative analysis to estimate probabilities and uncertainty.
          The platform does not guarantee outcomes.
        </p>

        <ol className="relative mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <li key={stage.id} className="group relative bg-surface p-6">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-alpha">{stage.id}</span>
                <span className="h-px flex-1 bg-line transition-colors group-hover:bg-alpha/40" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{stage.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{stage.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
