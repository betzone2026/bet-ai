import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Risk disclosure' };

export default function Page() {
  return (
    <LegalPage eyebrow="Policy" title="Risk disclosure" updated="August 2026">
      <p>
        <strong>
          SportAlpha AI provides statistical and probabilistic analysis for informational
          purposes only. Predictions are not guarantees of future results.
        </strong>
      </p>

      <h2>Model limitations</h2>
      <p>
        Estimates are produced from historical data by models that are necessarily simplified.
        They can be wrong because the data is incomplete or stale, because a squad changes after
        the model runs, because conditions differ from anything in the training period, or
        because the model itself is misspecified. Sport is a high-variance domain: correct
        estimates routinely produce losing outcomes over short horizons.
      </p>

      <h2>Calibration and confidence</h2>
      <p>
        Confidence scores describe the amount of supporting evidence, not the chance of profit.
        Monte Carlo confidence intervals capture sampling uncertainty inside the model only —
        they do not capture the risk that the model is the wrong model.
      </p>

      <h2>Financial risk</h2>
      <p>
        Any money placed on a sporting outcome can be lost in full. Nothing here constitutes
        financial, investment or betting advice, and no part of this service should be relied on
        as a basis for a financial decision. You are solely responsible for your own decisions
        and for complying with the law where you live.
      </p>
    </LegalPage>
  );
}
