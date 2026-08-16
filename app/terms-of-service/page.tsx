import Link from "next/link";

export default function TermsOfServicePage() {
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
        <Link href="/" className="v2-back">← Back to World of Physics</Link>

        <div className="v2-page-eyebrow">§ Legal · Terms</div>
        <h1 className="v2-page-h1">Terms of <em>Service</em></h1>
        <div className="v2-updated">Last updated · August 10, 2026</div>
        <div className="v2-rule" />

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of World of Physics, a practice
          rehearsal platform for the JEE and NEET computer-based test portals operated by
          Mr. Biman Dhawa. By accessing or using World of Physics you agree to these Terms.
        </p>

        <h2>§ 1 · Use of the Service</h2>
        <ul>
          <li>World of Physics is provided for <strong>practice and preparation only</strong>.</li>
          <li>
            You must be at least 13 years old, or have parental permission, to use the
            service.
          </li>
          <li>
            You are responsible for keeping your test codes and account credentials
            confidential.
          </li>
        </ul>

        <h2>§ 2 · Not an Official Portal</h2>
        <p>
          World of Physics is <strong>not affiliated with, endorsed by, or connected to</strong> the
          National Testing Agency (NTA) or any examination authority. It is an independent
          rehearsal tool designed to familiarize students with the CBT interface.
        </p>

        <h2>§ 3 · Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any unlawful purpose.</li>
          <li>Attempt to disrupt, overload, or compromise the platform or other users.</li>
          <li>Copy, resell, or redistribute the content or software without permission.</li>
          <li>Impersonate others or misrepresent your affiliation.</li>
        </ul>

        <h2>§ 4 · Accounts</h2>
        <p>
          Where accounts are provided, you agree to supply accurate information and to keep
          it up to date. We may suspend or terminate access that violates these Terms.
        </p>

        <h2>§ 5 · Intellectual Property</h2>
        <p>
          The World of Physics design, software, and original content are owned by Mr. Biman Dhawa
          and its developers. Practice questions are provided for study; respect any
          third-party rights in source material.
        </p>

        <h2>§ 6 · Disclaimers</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties of any kind. We do not
          guarantee that practice scores predict actual exam performance, nor that the portal
          exactly matches the official interface at all times.
        </p>

        <h2>§ 7 · Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, World of Physics and its operator shall not be
          liable for any indirect, incidental, or consequential damages arising from your use
          of the service.
        </p>

        <h2>§ 8 · Termination</h2>
        <p>
          You may stop using World of Physics at any time. We may discontinue or modify the service,
          or end your access, with or without notice, for any reason.
        </p>

        <h2>§ 9 · Changes to These Terms</h2>
        <p>
          We may revise these Terms periodically. Continued use after changes constitutes
          acceptance of the updated Terms.
        </p>

        <h2>§ 10 · Contact</h2>
        <p>
          Questions about these Terms? Email
          <a href="mailto:hello@examsite.in">hello@examsite.in</a> or write to Mr. Biman
          Dhawa, Belda, India.
        </p>
      </article>
    </div>
  );
}
