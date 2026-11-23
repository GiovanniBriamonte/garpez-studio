import type { Metadata } from 'next';
import { FactCard } from './fact-card';

export const metadata: Metadata = {
  title: 'Privacy — Garpez Co.',
  description: 'Placeholder privacy policy for the Garpez site.',
};

function mail() {
  return <a href="mailto:ciao@garpez.studio">ciao@garpez.studio</a>;
}

export default function PrivacyPage() {
  return (
    <main className="privacy">
      <div className="privacy-col">
        <header className="privacy-head">
          <h1>Privacy Policy</h1>
          <p>Garpez 2026</p>
        </header>

        <p>
          Garpez is a design studio in Oslo. This page is a placeholder for the real policy. It explains
          what this site collects, how we use it, and how to ask us about it. We only keep what we need to
          answer you and to keep the site up.
        </p>

        <h2>Who we are</h2>
        <p>This page covers garpez.studio. We are the only ones who handle what you send us.</p>

        <h2>What we collect</h2>
        <p>There is no account and no form on this site. We only hear from you if you email us.</p>
        <FactCard
          rows={[
            { label: 'Account:', value: 'None' },
            { label: 'Form:', value: 'None' },
            { label: 'From an email:', value: 'Name, email, message' },
            { label: 'Server notes:', value: 'IP, browser, pages' },
          ]}
        />

        <h2>How we use it</h2>
        <p>We read your email so we can answer it. We look at the server notes when something breaks.</p>
        <FactCard
          rows={[
            { label: 'Sell:', value: 'No' },
            { label: 'Advertise:', value: 'No' },
            { label: 'Follow you:', value: 'No' },
            { label: 'Used to:', value: 'Answer you, fix the site' },
          ]}
        />

        <h2>Cookies</h2>
        <p>The host may set one cookie that is needed to deliver the page. Nothing here is used to follow you.</p>

        <h2>Who else sees it</h2>
        <p>
          The site is hosted by a third party, who sees the server notes as part of running it. If you email
          us, that message sits in our inbox. We would share something only if the law required it.
        </p>

        <h2>How long we keep it</h2>
        <p>We keep an email while the conversation is useful. Server notes stay for a short while, then they are dropped.</p>

        <h2>Your rights</h2>
        <p>
          If you are in the EEA or the UK you can also complain to your data authority. Start with an email
          and we will reply.
        </p>
        <FactCard
          rows={[
            { label: 'You can:', value: 'See, correct, delete' },
            { label: 'Ask:', value: mail() },
          ]}
        />
      </div>
    </main>
  );
}
