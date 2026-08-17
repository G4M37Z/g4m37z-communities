// src/app/privacy/page.tsx
// Privacy Policy. Public route. Paired with /terms.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How G4M37Z Communities collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <main className="container-x py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
            Legal
          </p>
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
            We collect only the information needed to run the service.
          </p>
        </header>

        <Section id="what-we-collect" title="1. What we collect">
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>
              <strong className="text-fg">Account data:</strong> email address, username,
              display name, profile bio, and avatar image.
            </li>
            <li>
              <strong className="text-fg">Content you create:</strong> posts, comments,
              votes, and reports you submit through the platform.
            </li>
            <li>
              <strong className="text-fg">Usage data:</strong> basic server logs
              (timestamps, request paths) for security and debugging.
            </li>
            <li>
              <strong className="text-fg">Cookies:</strong> required for sign-in
              sessions. No advertising or analytics cookies.
            </li>
          </ul>
        </Section>

        <Section id="how-we-use" title="2. How we use it">
          <p>
            We use this information only to operate, secure, and improve the service:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>Authenticate you and keep you signed in across requests.</li>
            <li>Display your posts and comments inside the platform.</li>
            <li>Send you notifications about activity on your content.</li>
            <li>Investigate abuse and enforce our Terms of Service.</li>
          </ul>
          <p>
            We do <strong className="text-fg">not</strong> sell your data, and we do
            not run third-party advertising.
          </p>
        </Section>

        <Section id="sharing" title="3. Sharing">
          <p>
            Public content (posts, comments, display name) is visible to other signed-in
            users by default. Private information like your email and password is never
            exposed to other users.
          </p>
          <p>
            We share information with service providers strictly as needed to operate
            the platform (hosting, database, email delivery). Each provider is bound
            by their own privacy commitments.
          </p>
        </Section>

        <Section id="retention" title="4. Retention">
          <p>
            We keep your account data for as long as your account is active. If you
            delete your account, we delete your profile, posts, comments, votes, and
            notifications. Server logs are retained for up to 30 days for security
            purposes.
          </p>
        </Section>

        <Section id="rights" title="5. Your rights">
          <p>You can:</p>
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>Update your display name, bio, and avatar from <Link href="/settings" className="text-accent hover:underline">Settings</Link>.</li>
            <li>Delete your content (posts, comments) at any time.</li>
            <li>Request export of all data we hold about you.</li>
            <li>
              Request account deletion by emailing our support contact.
            </li>
          </ul>
        </Section>

        <Section id="security" title="6. Security">
          <p>
            Your password is stored as a one-way cryptographic hash (bcrypt) — not as
            plain text. Database access is locked down by Supabase Row Level Security
            policies that restrict each table to its appropriate owners.
          </p>
          <p>
            Despite reasonable efforts, no system is perfectly secure. Use a unique
            password and consider enabling two-factor authentication on your email
            account.
          </p>
        </Section>

        <Section id="changes" title="7. Changes to this policy">
          <p>
            If we make significant changes, we will notify active users through an
            in-app notification. The &quot;Last updated&quot; date at the top of this
            page reflects the latest revision.
          </p>
        </Section>

        <footer className="mt-12 border-t border-border pt-6">
          <Link
            href="/terms"
            className="text-sm font-medium text-accent hover:underline"
          >
            Read the Terms of Service →
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="mb-8 rounded-2xl border border-border bg-surface p-6 sm:p-8"
    >
      <h2
        id={`${id}-heading`}
        className="mb-3 text-lg font-bold text-fg sm:text-xl"
      >
        {title}
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-fg [&_p]:text-text-muted">
        {children}
      </div>
    </section>
  );
}