import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Responsible gambling' };

export default function Page() {
  return (
    <LegalPage eyebrow="Policy" title="Responsible gambling" updated="August 2026">
      <p>
        SportAlpha AI is an analytics product. It estimates probabilities and quantifies
        uncertainty. It does not tell anyone what to bet, how much to stake, or when to stake it,
        and it has no way of knowing whether any individual outcome will occur.
      </p>

      <h2>What a probability means here</h2>
      <p>
        A 62% estimate means the model expects that outcome in roughly six of every ten
        comparable situations. It says nothing about the next single match. A high confidence
        score reflects the quantity and quality of the data behind an estimate, not the
        likelihood of a favourable result.
      </p>

      <h2>Signs worth taking seriously</h2>
      <p>
        Chasing losses, staking money set aside for something else, hiding activity from people
        close to you, or finding that the time spent on it is displacing work, sleep or
        relationships. If any of that is familiar, treat it as a reason to stop and get support
        rather than a reason to look for better analysis.
      </p>

      <h2>Where to get help</h2>
      <p>
        Free and confidential support is available in most countries. In the United Kingdom,
        GamCare operates the National Gambling Helpline. BeGambleAware and Gambling Therapy offer
        online support internationally. In Italy, the Ministry of Health runs a national helpline
        for gambling disorder. Most licensed operators also offer self-exclusion schemes, and
        blocking software can restrict access at the device or bank level.
      </p>

      <h2>Our commitments</h2>
      <p>
        We do not use language implying certainty or guaranteed returns anywhere in this product
        or in our marketing. We do not sell selections. We show uncertainty alongside every
        estimate, including when it is wide. We will close any account on request.
      </p>
    </LegalPage>
  );
}
