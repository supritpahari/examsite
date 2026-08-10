import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div
      className="v2-root"
      style={
        {
          "--paper": "#f4f0e8",
          "--paper-2": "#ebe6da",
          "--ink": "#14110d",
          "--ink-2": "#3a352c",
          "--dim": "#8a8275",
          "--rule": "#d9d1bf",
          "--accent": "oklch(0.52 0.20 25)",
          "--accent-2": "oklch(0.42 0.22 25)",
        } as React.CSSProperties
      }
    >
      <style>{`
        .v2-root {
          min-height: 100vh;
          background: var(--paper);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
          position: relative;
        }
        .v2-root::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(20,17,13,0.04) 1px, transparent 1px);
          background-size: 4px 4px;
          opacity: 0.6;
        }
        .v2-root .serif { font-family: 'Instrument Serif', 'Times New Roman', serif; font-weight: 400; }
        .v2-root .mono { font-family: 'JetBrains Mono', monospace; }

        .v2-doc {
          max-width: 820px;
          margin: 0 auto;
          padding: 72px 48px 56px;
          position: relative;
        }

        .v2-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--accent);
          text-decoration: none;
          margin-bottom: 28px;
        }
        .v2-back:hover { color: var(--accent-2); }

        .v2-page-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .v2-page-h1 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(44px, 6vw, 72px);
          color: #14110d;
          line-height: 0.96;
          letter-spacing: -0.02em;
          font-weight: 400;
          margin: 0 0 14px;
        }
        .v2-page-h1 em { font-style: italic; color: var(--accent); }

        .v2-updated {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--dim);
          margin-bottom: 36px;
        }

        .v2-rule {
          height: 1px;
          background: var(--rule);
          margin: 0 0 36px;
        }

        .v2-doc h2 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--accent);
          margin: 40px 0 14px;
        }

        .v2-doc p {
          font-size: 16px;
          line-height: 1.7;
          color: var(--ink-2);
          margin: 0 0 16px;
        }

        .v2-doc ul {
          margin: 0 0 18px;
          padding-left: 22px;
        }
        .v2-doc li {
          font-size: 16px;
          line-height: 1.7;
          color: var(--ink-2);
          margin-bottom: 8px;
        }
        .v2-doc a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent); }
        .v2-doc a:hover { color: var(--accent-2); border-color: var(--accent-2); }

        .v2-doc strong { color: var(--ink); }

        @media (max-width: 960px) {
          .v2-doc { padding: 56px 24px 40px; }
        }
      `}</style>

      <article className="v2-doc">
        <Link href="/" className="v2-back">← Back to ExamSite</Link>

        <div className="v2-page-eyebrow">§ Legal · Privacy</div>
        <h1 className="v2-page-h1">Privacy <em>Policy</em></h1>
        <div className="v2-updated">Last updated · August 10, 2026</div>
        <div className="v2-rule" />

        <p>
          ExamSite (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is a practice
          rehearsal platform for the JEE and NEET computer-based test portals, operated by
          Mr. Biman Dhawa. This Privacy Policy explains what information we collect, how we
          use it, and the choices you have. By using ExamSite you agree to the practices
          described here.
        </p>

        <h2>§ 1 · Information We Collect</h2>
        <p>We collect only what is needed to run mock examinations:</p>
        <ul>
          <li>
            <strong>Test codes and session data</strong> you enter to start a mock exam.
          </li>
          <li>
            <strong>Response activity</strong> such as answers selected, questions marked
            for review, and time spent — stored per practice session.
          </li>
          <li>
            <strong>Account and contact details</strong> (name, email) if you register or
            contact us.
          </li>
          <li>
            <strong>Technical data</strong> like browser type, device, and usage logs for
            diagnostics and security.
          </li>
        </ul>

        <h2>§ 2 · How We Use Information</h2>
        <ul>
          <li>Deliver and score mock tests, and show you your performance.</li>
          <li>Improve the realism and reliability of the practice portal.</li>
          <li>Communicate with you about sessions, updates, and support.</li>
          <li>Prevent abuse, cheating, and unauthorized access.</li>
        </ul>

        <h2>§ 3 · Data Sharing</h2>
        <p>
          We do not sell your personal data. We share information only with service
          providers who help operate the site (hosting, email, analytics) under
          confidentiality obligations, or when required by law.
        </p>

        <h2>§ 4 · Cookies &amp; Local Storage</h2>
        <p>
          We use cookies and browser local storage to keep you signed in, remember your
          preferences, and understand usage. You can disable cookies in your browser, but
          some features may not work.
        </p>

        <h2>§ 5 · Data Retention</h2>
        <p>
          We keep practice and account data for as long as your account is active or as
          needed to provide the service. You may request deletion at any time.
        </p>

        <h2>§ 6 · Your Rights</h2>
        <p>
          Depending on your location, you may have the right to access, correct, export, or
          delete your personal data, and to object to certain processing. To exercise these
          rights, contact us at <a href="mailto:hello@examsite.in">hello@examsite.in</a>.
        </p>

        <h2>§ 7 · Children&apos;s Privacy</h2>
        <p>
          ExamSite is intended for students preparing for entrance exams. We do not
          knowingly collect personal data from children without parental consent where
          required by law.
        </p>

        <h2>§ 8 · Security</h2>
        <p>
          We use reasonable administrative and technical measures to protect your data. No
          method of transmission or storage is completely secure, so we cannot guarantee
          absolute security.
        </p>

        <h2>§ 9 · Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          posted here with a revised &quot;Last updated&quot; date.
        </p>

        <h2>§ 10 · Contact</h2>
        <p>
          Questions about this policy? Email
          <a href="mailto:hello@examsite.in">hello@examsite.in</a> or write to Mr. Biman
          Dhawa, Belda, India.
        </p>
      </article>
    </div>
  );
}
