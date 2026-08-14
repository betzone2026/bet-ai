import { ButtonLink } from '@/components/ui/button';
import { ConvergenceHero } from '@/components/landing/convergence';
import { DashboardPreview } from '@/components/landing/dashboard-preview';
import { Pipeline } from '@/components/landing/pipeline';
import { MonteCarloSection } from '@/components/landing/monte-carlo-section';

export default function HomePage() {
  return (
    <>
      {/* Hero ------------------------------------------------------- */}
      <section className="grid-field relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-alpha/40 to-transparent" />
        <div className="mx-auto grid max-w-shell gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <div className="animate-fade-up">
            <p className="eyebrow">AI-powered sports probability intelligence</p>

            <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl">
              Turn sports data
              <br />
              into <span className="text-alpha">probabilities</span>.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              SportAlpha AI transforms sports data into actionable probability intelligence
              using statistical models, machine learning and Monte Carlo simulations.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/register" size="lg">
                Start analyzing
              </ButtonLink>
              <ButtonLink href="/#analytics" variant="secondary" size="lg">
                See how it works
              </ButtonLink>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-7">
              <div>
                <dt className="eyebrow">Paths per run</dt>
                <dd className="tabular mt-1.5 font-mono text-xl">500k</dd>
              </div>
              <div>
                <dt className="eyebrow">Models</dt>
                <dd className="tabular mt-1.5 font-mono text-xl">Poisson · Elo</dd>
              </div>
              <div>
                <dt className="eyebrow">Output</dt>
                <dd className="tabular mt-1.5 font-mono text-xl">1X2 · O/U · BTTS</dd>
              </div>
            </dl>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <ConvergenceHero />
          </div>
        </div>
      </section>

      <DashboardPreview />
      <Pipeline />
      <MonteCarloSection />

      {/* Closing ---------------------------------------------------- */}
      <section className="border-t border-line py-20 sm:py-24">
        <div className="mx-auto max-w-shell px-5 text-center lg:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Start with the free tier
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
            Three analyses a day, 10,000-path simulations and the AI Analyst. No card required.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/register" size="lg">Create account</ButtonLink>
            <ButtonLink href="/pricing" variant="secondary" size="lg">Compare plans</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
