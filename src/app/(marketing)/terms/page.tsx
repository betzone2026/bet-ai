import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Terms of service' };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of service" updated="August 2026">
      <p>
        These terms are a starting template and must be reviewed by a qualified lawyer in your
        operating jurisdiction before launch.
      </p>

      <h2>The service</h2>
      <p>
        SportAlpha AI provides statistical analysis of sporting events. Access is licensed, not
        sold, and is granted per account for the duration of an active subscription.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old, or the age of majority where you live, whichever is
        higher. Accounts may not be shared or resold.
      </p>

      <h2>Acceptable use</h2>
      <p>
        You may not scrape the interface, redistribute model output as your own product, resell
        access, or present our estimates as guaranteed outcomes to third parties.
      </p>

      <h2>Billing</h2>
      <p>
        Subscriptions are billed monthly in advance through Stripe and renew automatically until
        cancelled. Cancelling stops the next renewal and leaves access in place until the end of
        the paid period.
      </p>

      <h2>Liability</h2>
      <p>
        The service is provided as is. To the fullest extent permitted by law we exclude
        liability for losses arising from decisions taken on the basis of our analysis.
      </p>
    </LegalPage>
  );
}
