/* Hallmark · genre: playful · theme: Hum · macrostructure: Long Document · design-system: design.md · designed-as-app */
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import FormulaMarks from "./FormulaMarks";

interface LegalDocProps {
  title: ReactNode;
  updated: string;
  children: ReactNode;
}

/**
 * Shared shell for the legal pages — Long Document family.
 * Continuous prose, ordinal section heads, measure capped at 65ch.
 */
export default function LegalDoc({ title, updated, children }: LegalDocProps) {
  return (
    <div className="legal-root">
      <style>{`
        .legal-root { min-height: 100vh; background: var(--color-paper); color: var(--color-ink); position: relative; isolation: isolate; }

        .legal-nav { max-width: var(--page-max); margin-inline: auto; padding: 1.1rem var(--page-gutter); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-rule); }
        .legal-brand { font-family: var(--font-display); font-weight: 700; font-size: 1rem; letter-spacing: -0.03em; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; }
        .legal-brand-logo { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--color-rule-2); flex: 0 0 auto; }
        .legal-back { font-family: var(--font-mono); font-size: 0.68rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; color: var(--color-muted); text-decoration: none; }
        .legal-back:hover { color: var(--color-accent-2-deep); }

        .legal-doc { max-width: 65ch; margin-inline: auto; padding: var(--space-2xl) var(--page-gutter) var(--space-3xl); }
        .legal-doc h1 { font-size: clamp(2rem, 5vw + 0.8rem, 3.25rem); letter-spacing: -0.03em; line-height: 1.05; margin: 0 0 var(--space-sm); max-width: 16ch; }
        .legal-updated { font-family: var(--font-mono); font-size: 0.66rem; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-muted); margin-bottom: var(--space-xl); padding-bottom: var(--space-md); border-bottom: 1px solid var(--color-rule); }

        .legal-doc h2 { font-size: 1.05rem; font-weight: 600; letter-spacing: -0.015em; color: var(--color-ink); margin: var(--space-xl) 0 var(--space-sm); }
        .legal-doc p, .legal-doc li { font-size: 1rem; line-height: 1.72; color: var(--color-ink-2); }
        .legal-doc p { margin: 0 0 var(--space-md); }
        .legal-doc ul { margin: 0 0 var(--space-md); padding-left: 1.4rem; }
        .legal-doc li { margin-bottom: 0.45rem; }
        .legal-doc a { color: var(--color-accent-2-deep); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
        .legal-doc a:hover { color: var(--color-ink); }
        .legal-doc strong { color: var(--color-ink); font-weight: 600; }

        @media (max-width: 640px) {
          .legal-doc { padding-top: var(--space-xl); }
        }
      `}</style>

      <FormulaMarks />
      <nav className="legal-nav">
        <Link href="/" className="legal-brand">
          <Image src="/logo.png" alt="" width={28} height={28} className="legal-brand-logo" priority />
          World of Physics
        </Link>
        <Link href="/" className="legal-back">← Back to portal</Link>
      </nav>

      <article className="legal-doc">
        <h1>{title}</h1>
        <div className="legal-updated">Last updated · {updated}</div>
        {children}
      </article>
    </div>
  );
}
