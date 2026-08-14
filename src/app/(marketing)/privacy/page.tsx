import type { Metadata } from 'next';
import { LegalPage } from '../legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Page() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="August 2026">
      <p>
        This policy is a starting template and must be reviewed against the GDPR and any other
        applicable regime before launch.
      </p>

      <h2>What we store</h2>
      <p>
        Your email address, an optional display name and avatar, your plan and subscription
        state, the simulations you run, and daily counters of feature usage. Authentication is
        handled by Netlify Identity; card details are handled by Stripe and never reach our servers.
      </p>

      <h2>Why we store it</h2>
      <p>
        To operate your account, enforce plan limits, bill you correctly, and understand which
        parts of the product are used. We do not sell personal data.
      </p>

      <h2>AI processing</h2>
      <p>
        Questions asked in the AI Analyst are sent to our language-model provider together with
        the computed statistics for the selected fixture. Do not include personal or sensitive
        information in those messages.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data at any time from Settings, or by
        writing to privacy@sportalpha.ai. Deleting your account removes your profile, simulation
        history and usage records.
      </p>
    </LegalPage>
  );
}
