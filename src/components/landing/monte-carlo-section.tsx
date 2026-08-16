import { PLAN_LIST, formatLimit } from '@/lib/config/plans';

export function MonteCarloSection() {
  return (
    <section id="monte-carlo" className="border-t border-line py-20 sm:py-28">
      <div className="mx-auto max-w-shell px-5 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="eyebrow">Monte Carlo</p>
            <h2 className="mt-3 font-display text-section font-semibold sm:text-section-lg">
              A distribution, not a pick
            </h2>
            <p className="mt-5 text-lead text-muted">
              Every fixture is played out thousands of times against sampled scoring rates.
              What comes back is the full spread of outcomes: how often each result occurs,
              which score lines dominate, and how wide the interval around each estimate is.
            </p>
            <p className="mt-4 text-lead text-muted">
              A wide interval is information. It tells you the model is uncertain, and the
              interface says so instead of hiding it behind a single confident number.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 hairline-top">
            <p className="eyebrow">Paths per run</p>
            <ul className="mt-4 divide-y divide-line">
              {PLAN_LIST.map((plan) => (
                <li key={plan.id} className="flex items-baseline justify-between py-3">
                  <span className="text-body text-ink">{plan.name}</span>
                  <span className="tabular font-mono text-body text-alpha">
                    {formatLimit(plan.limits.monteCarloLimit)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
