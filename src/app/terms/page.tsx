// src/app/terms/page.tsx
// Terms of Service. Public route. Required reading before signup.
// Markdown-like structure rendered as semantic HTML sections.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions governing your use of G4M37Z Communities.",
};

export default function TermsPage() {
  return (
    <main className="container-x py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
            Legal
          </p>
          <h1 className="text-3xl font-black tracking-tight text-fg sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Last updated: {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}.
            By creating an account or using G4M37Z Communities, you agree to these terms.
          </p>
        </header>

        <Section id="eligibility" title="1. Eligibility">
          <p>
            You must be at least 13 years old to use G4M37Z Communities. If you are under 18,
            you confirm that a parent or guardian has reviewed these terms and consents to
            your use of the service. You are responsible for ensuring that your participation
            complies with the laws of your jurisdiction.
          </p>
        </Section>

        <Section id="account" title="2. Your account">
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>
              Choose a unique username. Usernames are permanent and cannot be changed
              after signup.
            </li>
            <li>
              You are responsible for the security of your account and password. Use a
              strong password and never share it with anyone.
            </li>
            <li>
              You agree to provide accurate information during signup. Impersonating
              other users, brands, or public figures is not allowed.
            </li>
            <li>
              We may suspend or terminate accounts that violate these terms.
            </li>
          </ul>
        </Section>

        <Section id="content" title="3. Content you post">
          <p>You retain ownership of the content you post. By posting, you grant us:</p>
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>
              A worldwide, royalty-free license to host, display, and distribute that
              content within the service.
            </li>
            <li>
              Permission to remove or moderate content that violates these terms or
              community guidelines.
            </li>
          </ul>
          <p>You agree not to post content that:</p>
          <ul className="list-disc space-y-2 pl-6 text-text-muted">
            <li>Is illegal, harmful, threatening, abusive, harassing, or defamatory.</li>
            <li>Targets or discriminates against any individual or group.</li>
            <li>
              Contains sexual content involving minors, or exploits minors in any way.
            </li>
            <li>
              Infringes intellectual property rights, including copyrights, trademarks,
              or trade secrets.
            </li>
            <li>
              Constitutes spam, misleading information, or coordinated manipulation.
            </li>
            <li>
              Attempts to compromise the service, other users, or their accounts.
            </li>
          </ul>
        </Section>

        <Section id="moderation" title="4. Moderation">
          <p>
            G4M37Z Communities is moderated by community moderators and platform
            administrators. Reports are reviewed and acted upon at our discretion. We may
            remove content, issue warnings, suspend, or ban accounts that violate these
            terms. Decisions are final in the absence of a successful appeal.
          </p>
          <p>
            If you believe your content was removed in error, you can respond to the
            notification received when the action was taken. Server actions on the
            platform are governed by role-based access controls in our database.
          </p>
        </Section>

        <Section id="ip" title="5. Intellectual property">
          <p>
            The platform itself — including its name, design, code, and trademarks — is
            owned by G4M37Z. You may not copy, redistribute, or resell the platform or
            any portion of it without written permission.
          </p>
        </Section>

        <Section id="disclaimers" title="6. Disclaimers and liability">
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind. We do
            our best to keep it running, available, and safe, but we cannot guarantee
            uninterrupted access or that content posted by other users is accurate.
          </p>
          <p>
            To the maximum extent permitted by law, G4M37Z is not liable for any
            indirect, incidental, or consequential damages arising from your use of the
            service.
          </p>
        </Section>

        <Section id="changes" title="7. Changes to these terms">
          <p>
            We may update these terms occasionally. When we do, the &quot;Last updated&quot;
            date at the top will change. Continued use of the service after an update
            constitutes acceptance of the new terms. For major changes, we will notify
            active users via in-app notification.
          </p>
        </Section>

        <Section id="contact" title="8. Contact">
          <p>
            Questions about these terms? Reach out through the platform
            <Link href="/communities" className="text-accent hover:underline">
              communities
            </Link>{" "}
            or report content using the in-app report button.
          </p>
        </Section>

        <footer className="mt-12 border-t border-border pt-6">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Back to sign up
          </Link>
          <p className="mt-4 text-xs text-text-muted">
            By signing up, you confirm that you have read and agree to these Terms of Service.
          </p>
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