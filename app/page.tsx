/* Hallmark · genre: playful · theme: Hum · macrostructure: Stat-Led · design-system: design.md · designed-as-app · nav: N1b · footer: Ft8 · pre-emit critique: P5 H4 E4 S5 R4 V5 · contrast: pass (40–41) */
"use client";

import { useEffect, useState } from "react";
import { loadSiteInfo, DEFAULT_SITE_INFO, type SiteInfo } from "@/lib/settings";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FormulaMarks from "./_components/FormulaMarks";
import { onAuthState } from "@/lib/firebase/client";
import PhoneAuth from "./_components/PhoneAuth";

export default function Home() {
  const [code, setCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [siteInfo, setSiteInfo] = useState<SiteInfo>(DEFAULT_SITE_INFO);
  const [auth, setAuth] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    loadSiteInfo()
      .then(setSiteInfo)
      .catch(() => setSiteInfo(DEFAULT_SITE_INFO));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const unsub = onAuthState((u) => {
      const phoneOk = Boolean(u?.providerData?.some((p) => p.providerId === "phone"));
      setAuth(phoneOk ? "in" : "out");
    });
    return unsub;
  }, []);

  const router = useRouter();

  const sanitizeCode = (raw: string): string =>
    raw
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^A-Z0-9_]/g, "")
      .replace(/_{2,}/g, "_");

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);

  const codeReady = code.trim().length > 0;
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().replace(/^_+|_+$/g, "");
    if (!trimmed) return;
    router.push(`/exam?id=${encodeURIComponent(trimmed)}`);
  };

  const codeForm = (
    <form className="code-form" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor="test-code">Test code</label>
      <input
        id="test-code"
        type="text"
        placeholder="PHY_JEE_2026_04"
        maxLength={18}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="characters"
        enterKeyHint="go"
        value={code}
        onChange={(e) => setCode(sanitizeCode(e.target.value))}
      />
      <button type="submit" className="btn" disabled={!codeReady}>Begin your test</button>
    </form>
  );

  return (
    <div className="lp-root">
      <FormulaMarks />
      <style>{`
        .lp-root { min-height: 100vh; background: var(--color-paper); color: var(--color-ink); position: relative; isolation: isolate; }

        /* ---------- Nav · N1b SaaS three-section ---------- */
        .lp-nav { position: fixed; inset: 0 0 auto; z-index: var(--z-sticky); border-bottom: 1px solid transparent; transition: background var(--dur-short) var(--ease-out), border-color var(--dur-short), box-shadow var(--dur-short); }
        .lp-nav.is-scrolled { background: color-mix(in oklch, var(--color-paper) 78%, transparent); backdrop-filter: blur(16px) saturate(1.5); border-bottom-color: var(--color-rule); box-shadow: 0 10px 30px -18px oklch(20% 0.012 250 / 0.35); }
        .lp-nav-inner { max-width: var(--page-max); margin-inline: auto; padding-inline: var(--page-gutter); height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .lp-brand { justify-self: start; font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; letter-spacing: -0.03em; text-decoration: none; color: var(--color-ink); display: inline-flex; align-items: center; gap: 0.55rem; white-space: nowrap; }
        .lp-brand-logo { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--color-rule-2); flex: 0 0 auto; }
        .lp-nav-center { display: flex; align-items: center; gap: 0.25rem; margin-left: auto; }
        .lp-nav-link { font-family: var(--font-body); font-weight: 500; font-size: 0.9rem; color: var(--color-ink-2); text-decoration: none; padding: 0.5rem 0.8rem; border-radius: var(--radius-sm); transition: color var(--dur-micro), background var(--dur-micro); white-space: nowrap; }
        .lp-nav-link:hover { color: var(--color-ink); background: var(--color-paper-2); }
        .lp-nav-btn { font-family: var(--font-body); font-weight: 600; font-size: 0.85rem; color: var(--color-accent-2-deep); text-decoration: none; background: var(--color-tint-cyan); border-radius: var(--radius-pill); padding: 0.45rem 1rem; transition: background var(--dur-micro), transform var(--dur-micro); white-space: nowrap; letter-spacing: 0.02em; text-transform: uppercase; }
        .lp-nav-btn:hover { background: var(--color-accent-2); color: var(--color-on-accent-2); transform: translateY(-1px); }

        /* ---------- Hero · Stat-Led, off-centre, no centred stack ---------- */
        .lp-hero { max-width: var(--page-max); margin-inline: auto; padding: 104px var(--page-gutter) var(--space-2xl); display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: var(--space-xl); align-items: center; }

        .lp-hero-copy { min-width: 0; }
        .lp-h1 { font-size: var(--text-display); font-weight: 600; letter-spacing: -0.03em; line-height: 1.02; margin: var(--space-md) 0 var(--space-lg); max-width: 11ch; }
        .lp-sub { font-size: 1.075rem; line-height: 1.6; color: var(--color-ink-2); max-width: 46ch; margin: 0 0 var(--space-xl); }

        /* The instrument */
        .lp-code { background: var(--color-paper); border: 1px solid var(--color-rule-2); border-radius: var(--radius-card); box-shadow: var(--shadow-lift); padding: var(--space-lg); max-width: 460px; position: relative; }
        .lp-code-label { display: block; margin-bottom: var(--space-sm); }
        .code-form { display: flex; gap: var(--space-xs); align-items: stretch; }
        .code-form input {
          flex: 1 1 auto; min-width: 0; background: var(--color-paper-2); border: 1.5px solid transparent;
          border-radius: var(--radius-input); padding: 0.75rem 0.9rem; font-family: var(--font-mono); font-size: 1rem;
          letter-spacing: 0.14em; color: var(--color-ink); text-transform: uppercase; outline: none; transition: border-color var(--dur-micro), background var(--dur-micro);
        }
        .code-form input::placeholder { color: var(--color-muted); letter-spacing: 0.14em; }
        .code-form input:focus { border-color: var(--color-accent-2); background: var(--color-paper); }
        .code-form .btn { flex: 0 0 auto; }
        .lp-code-sheets { width: 100%; margin-top: var(--space-sm); }
        .lp-code-note { margin: var(--space-sm) 0 0; font-size: 0.8rem; color: var(--color-muted); line-height: 1.5; }

        /* The figure — the hero's density lives here, not in cards */
        .lp-figure-wrap { position: relative; justify-self: center; }
        .lp-figure { background: var(--color-tint-pear); border-radius: 28px; padding: clamp(1.5rem, 4vw, 2.5rem) clamp(1.25rem, 4vw, 2.25rem); text-align: center; box-shadow: var(--shadow-card); transform: rotate(1.25deg); }
        .lp-figure-num { font-family: var(--font-display); font-weight: 700; font-variant-numeric: tabular-nums; font-size: clamp(4.5rem, 13vw, 7rem); line-height: 0.95; letter-spacing: -0.04em; color: var(--color-ink); }
        .lp-figure-num small { font-size: 0.28em; font-weight: 600; letter-spacing: 0.02em; vertical-align: super; color: var(--color-ink-2); margin-left: 0.12em; }
        .lp-figure-cap { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-ink-2); margin-top: var(--space-sm); }
        .lp-figure-sub { font-size: 0.85rem; color: var(--color-ink-2); margin-top: var(--space-xs); }

        /* Character moment · pear sticker */
        .lp-sticker { position: absolute; top: -24px; right: 18px; width: 96px; height: 96px; border-radius: 999px; background: var(--color-accent); color: var(--color-on-accent); display: grid; place-items: center; transform: rotate(-8deg); box-shadow: 0 6px 0 0 var(--color-accent-deep); animation: sticker-pulse 4s var(--ease-in-out) infinite; }
        .lp-sticker span { font-family: var(--font-mono); font-size: 0.6rem; line-height: 1.45; letter-spacing: 0.1em; text-transform: uppercase; text-align: center; font-weight: 600; }
        @keyframes sticker-pulse { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(-8deg) scale(1.06); } }

        /* ---------- Interface band · Tier-A CSS artefact ---------- */
        .lp-band { background: var(--color-paper-2); border-top: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); }
        .lp-band-inner { max-width: var(--page-max); margin-inline: auto; padding: var(--space-2xl) var(--page-gutter); display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--space-2xl); align-items: center; }
        .lp-band h2 { font-size: var(--text-2xl); letter-spacing: -0.03em; margin: var(--space-sm) 0 var(--space-md); }
        .lp-band p { color: var(--color-ink-2); line-height: 1.6; max-width: 42ch; }

        .lp-steps { list-style: none; margin: var(--space-lg) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-sm); }
        .lp-step { display: grid; grid-template-columns: auto 1fr; gap: var(--space-md); align-items: baseline; padding: var(--space-sm) 0; border-top: 1px dashed var(--color-rule-2); }
        .lp-step-num { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; color: var(--color-accent-2-deep); }
        .lp-step strong { font-weight: 600; }
        .lp-step span:last-child { color: var(--color-ink-2); }


        /* ---------- Formula sheets strip ---------- */
        .lp-strip { max-width: var(--page-max); margin-inline: auto; padding: var(--space-2xl) var(--page-gutter) var(--space-3xl); display: grid; grid-template-columns: minmax(0, 7fr) auto; gap: var(--space-xl); align-items: center; }
        .lp-strip h2 { font-size: var(--text-2xl); letter-spacing: -0.03em; margin: 0 0 var(--space-xs); }
        .lp-strip p { color: var(--color-ink-2); margin: 0; max-width: 48ch; }

        /* ---------- Footer · Ft8 marquee + meta line ---------- */
        .lp-foot { border-top: 2px solid var(--color-ink); background: var(--color-paper); }
        .lp-marquee { overflow: hidden; padding-block: var(--space-md); border-bottom: 1px dashed var(--color-rule-2); }
        .lp-marquee-track { display: flex; gap: var(--space-2xl); white-space: nowrap; width: max-content; animation: lp-marquee 36s linear infinite; }
        .lp-marquee-track span { font-family: var(--font-display); font-weight: 700; font-size: clamp(1rem, 2.2vw, 1.35rem); letter-spacing: 0.02em; color: var(--color-ink); }
        .lp-marquee-track b { color: var(--color-accent-3); font-weight: 700; }
        @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .lp-foot-meta { max-width: var(--page-max); margin-inline: auto; padding: var(--space-md) var(--page-gutter); display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-md); flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-muted); }
        .lp-foot-meta a { color: var(--color-ink-2); text-decoration: none; border-bottom: 1px solid transparent; }
        .lp-foot-meta a:hover { color: var(--color-accent-2-deep); }
        .lp-foot-links { display: flex; gap: var(--space-lg); flex-wrap: wrap; }

        /* ---------- Dialog ---------- */
        .lp-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: oklch(20% 0.012 250 / 0.55); display: flex; align-items: center; justify-content: center; padding: var(--space-md); }
        .lp-dialog { width: 100%; max-width: 480px; background: var(--color-paper); border-radius: var(--radius-card); padding: var(--space-xl) var(--space-lg) var(--space-lg); position: relative; box-shadow: var(--shadow-lift); }
        .lp-dialog-close { position: absolute; top: 0.8rem; right: 0.9rem; width: 36px; height: 36px; border-radius: 999px; border: 1.5px solid var(--color-rule-2); background: transparent; cursor: pointer; font-size: 1.1rem; color: var(--color-ink); display: grid; place-items: center; transition: background var(--dur-micro), border-color var(--dur-micro); }
        .lp-dialog-close:hover { background: var(--color-paper-2); border-color: var(--color-ink); }
        .lp-dialog h3 { font-size: var(--text-lg); margin: 0 0 var(--space-xs); padding-right: 2rem; }
        .lp-dialog p { font-size: 0.85rem; color: var(--color-muted); margin: 0 0 var(--space-md); }
        /* The real portal screen, replica at preview scale — NTA light theme */
        .lp-cbt { border-radius: var(--radius-card); overflow: hidden; box-shadow: var(--shadow-lift); transform: rotate(-0.5deg); font-family: Arial, Helvetica, sans-serif; background: #eef1f6; border: 1px solid #c3cee3; }
        .lp-cbt-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 14px; background: linear-gradient(180deg, #21479b 0%, #1d3d8f 55%, #16306e 100%); color: #fff; }
        .lp-cbt-org { font-size: 8px; letter-spacing: 0.14em; text-transform: uppercase; color: #b9cdf3; margin-bottom: 2px; white-space: nowrap; }
        .lp-cbt-exam { font-size: 12.5px; font-weight: 700; line-height: 1.25; white-space: nowrap; }
        .lp-cbt-sub { font-size: 9px; color: #cfdcf8; margin-top: 2px; white-space: nowrap; }
        .lp-cbt-hr { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
        .lp-cbt-cand { display: flex; align-items: center; gap: 7px; }
        .lp-cbt-avatar { width: 30px; height: 30px; border-radius: 50%; background: #fff; color: #1d3d8f; display: grid; place-items: center; font-weight: 700; font-size: 11px; border: 2px solid #9db6e8; }
        .lp-cbt-cmeta { display: flex; flex-direction: column; line-height: 1.3; }
        .lp-cbt-clabel { font-size: 7.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #b9cdf3; }
        .lp-cbt-cname { font-size: 10.5px; font-weight: 700; }
        .lp-cbt-timer { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 4px; padding: 4px 10px; line-height: 1.25; border: 1px solid #9db6e8; }
        .lp-cbt-tlabel { font-size: 7.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
        .lp-cbt-tval { font-size: 14px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
        .lp-cbt-tabs { display: flex; align-items: center; gap: 2px; background: #d3dbea; padding: 0 8px; border-bottom: 1px solid #c3cee3; }
        .lp-cbt-tab { display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px 6px; font-size: 10.5px; font-weight: 700; color: #45536e; background: #c8d2e6; border: 1px solid transparent; border-bottom: none; border-radius: 5px 5px 0 0; position: relative; top: 1px; }
        .lp-cbt-tab.active { background: #fff; color: #1d3d8f; border-color: #c3cee3; }
        .lp-cbt-tabn { font-size: 8px; background: #1d3d8f; color: #fff; border-radius: 999px; padding: 1px 6px; font-weight: 700; }
        .lp-cbt-tinfo { margin-left: auto; font-size: 8.5px; color: #5b6883; white-space: nowrap; }
        .lp-cbt-main { display: grid; grid-template-columns: minmax(0, 1fr) 208px; }
        .lp-cbt-qcol { display: flex; flex-direction: column; background: #fff; min-width: 0; }
        .lp-cbt-qhead { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 14px; border-bottom: 1px solid #e3e8f0; }
        .lp-cbt-qno { font-size: 12px; font-weight: 700; color: #111827; display: flex; align-items: center; gap: 8px; }
        .lp-cbt-flag { font-size: 7px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; background: #8a3fd1; border-radius: 3px; padding: 2px 6px; }
        .lp-cbt-marks { display: flex; gap: 6px; }
        .lp-cbt-chip { font-size: 10px; font-weight: 700; border-radius: 3px; padding: 2px 8px; border: 1px solid; }
        .lp-cbt-chip.pos { color: #1c7c3c; border-color: #bfe3cb; background: #f0faf3; }
        .lp-cbt-chip.neg { color: #c02626; border-color: #f0c7c7; background: #fdf3f3; }
        .lp-cbt-qbody { padding: 12px 14px 14px; }
        .lp-cbt-qtext { font-size: 12px; line-height: 1.55; color: #111827; margin: 0 0 10px; }
        .lp-cbt-qtext .var { font-style: italic; }
        .lp-cbt-opts { display: flex; flex-direction: column; gap: 6px; }
        .lp-cbt-opt { display: flex; align-items: flex-start; gap: 8px; padding: 7px 9px; border: 1px solid #d7dee9; border-radius: 4px; background: #fff; min-height: 32px; }
        .lp-cbt-opt.sel { border-color: #2563eb; background: #e8f0fe; box-shadow: 0 0 0 1px #2563eb inset; }
        .lp-cbt-radio { width: 13px; height: 13px; border-radius: 50%; border: 2px solid #9aa6bb; background: #fff; flex: 0 0 auto; margin-top: 1px; }
        .lp-cbt-opt.sel .lp-cbt-radio { border-color: #2563eb; background: #2563eb; box-shadow: inset 0 0 0 2px #fff; }
        .lp-cbt-okey { font-weight: 700; font-size: 11px; color: #334155; }
        .lp-cbt-ot { font-size: 11.5px; color: #1f2937; line-height: 1.4; }
        .lp-cbt-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; background: #f4f7fb; border-top: 1px solid #dbe2ee; }
        .lp-cbt-agroup { display: flex; gap: 6px; }
        .lp-cbt-btn { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; font-size: 9.5px; font-weight: 700; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; min-height: 28px; }
        .lp-cbt-btn.mark { background: #2e6bc4; color: #fff; }
        .lp-cbt-btn.save { background: #1d3d8f; color: #fff; }
        .lp-cbt-btn.ghost { background: #fff; color: #3f4c66; border-color: #9aa8c2; }
        .lp-cbt-btn.submit { background: #d13c3c; color: #fff; }
        .lp-cbt-side { background: #e9edf4; border-left: 1px solid #d5dcea; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
        .lp-cbt-legend { background: #fff; border: 1px solid #d5dcea; border-radius: 4px; padding: 7px 8px 8px; }
        .lp-cbt-legend-title { font-size: 8px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #5b6883; margin-bottom: 5px; }
        .lp-cbt-lgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 6px; }
        .lp-cbt-lg { display: flex; align-items: flex-start; gap: 5px; font-size: 8px; line-height: 1.35; color: #333f55; }
        .lp-cbt-lg.wide { grid-column: 1 / -1; }
        .lp-cbt-lg i { width: 14px; height: 14px; border-radius: 3px; display: inline-grid; place-items: center; color: #fff; font-size: 8px; font-weight: 700; font-style: normal; flex-shrink: 0; position: relative; }
        .lp-cbt-lg .un { background: #98a2b3; } .lp-cbt-lg .no { background: #e04848; } .lp-cbt-lg .ans { background: #2fa14e; } .lp-cbt-lg .mk { background: #8a3fd1; }
        .lp-cbt-lg .mkans { background: #8a3fd1; }
        .lp-cbt-lg .mkans::after { content: ""; position: absolute; inset: 0; margin: auto; width: 6px; height: 6px; border-radius: 50%; background: #2fa14e; box-shadow: 0 0 0 1px #fff; }
        .lp-cbt-lg em { display: block; font-style: normal; color: #64748b; font-size: 7px; }
        .lp-cbt-ptitle { font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #45536e; }
        .lp-cbt-pal { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .lp-cbt-pb { aspect-ratio: 1; border: none; border-radius: 3px; color: #fff; font-size: 8.5px; font-weight: 700; display: grid; place-items: center; position: relative; font-family: Arial, Helvetica, sans-serif; }
        .lp-cbt-pb.un { background: #98a2b3; } .lp-cbt-pb.no { background: #e04848; } .lp-cbt-pb.ans { background: #2fa14e; } .lp-cbt-pb.mk { background: #8a3fd1; }
        .lp-cbt-pb.mkans::after { content: ""; position: absolute; inset: 0; margin: auto; width: 7px; height: 7px; border-radius: 50%; background: #2fa14e; box-shadow: 0 0 0 1.5px #fff; }
        .lp-cbt-pb.cur { outline: 2.5px solid #1d3d8f; outline-offset: 1px; z-index: 1; }
        .lp-cbt-sum { display: flex; gap: 6px; flex-wrap: wrap; font-size: 8.5px; color: #5b6883; }
        .lp-cbt-sum b { color: #1f2937; }
        .lp-cbt-foot { display: flex; flex-direction: column; gap: 5px; margin-top: auto; padding-top: 6px; border-top: 1px solid #d5dcea; }
        .lp-cbt-cap { font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-muted); margin-top: var(--space-sm); text-align: center; }

        @media (max-width: 1024px) {
          .lp-hero { grid-template-columns: minmax(0, 1fr); gap: var(--space-xl); padding-top: 96px; }
          .lp-figure-wrap { justify-self: start; }
          .lp-band-inner { grid-template-columns: minmax(0, 1fr); gap: var(--space-xl); }
          .lp-strip { grid-template-columns: minmax(0, 1fr); gap: var(--space-lg); }
        }
        @media (max-width: 900px) {
          .lp-nav-center { display: none; }
          .lp-nav-inner { justify-content: flex-start; }
        }
        @media (max-width: 640px) {
          .lp-h1 { font-size: clamp(2.5rem, 13vw, 3.2rem); }
          .code-form { flex-direction: column; }
          .code-form .btn { width: 100%; }
          .lp-sticker { width: 76px; height: 76px; top: -20px; right: 10px; }
          .lp-sticker span { font-size: 0.5rem; }
          .lp-figure { transform: none; }
          .lp-cbt { transform: none; }
          .lp-cbt-main { grid-template-columns: minmax(0, 1fr); }
          .lp-cbt-side { border-left: 0; border-top: 1px solid #d5dcea; }
          .lp-cbt-tinfo { display: none; }
          .lp-foot-meta { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
          .lp-overlay { align-items: flex-start; overflow-y: auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-sticker { animation: none; }
          .lp-marquee-track { animation: none; }
        }
      `}</style>

      {/* Nav */}
      <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="lp-nav-inner">
          <a className="lp-brand" href="/" aria-label="World of Physics — home">
            <Image src="/logo.png" alt="" width={30} height={30} className="lp-brand-logo" priority />
            World of Physics
          </a>
          <nav className="lp-nav-center" aria-label="Site">
          {auth === "loading" ? (
            <button className="lp-nav-btn" disabled>
              LOG IN
            </button>
          ) : auth === "in" ? (
            <Link href="/account" className="lp-nav-btn">
              Account
            </Link>
          ) : (
            <button className="lp-nav-btn" onClick={() => setAuthDialogOpen(true)}>
              LOG IN
            </button>
          )}
        </nav>
        </div>
      </header>

      {/* Hero · Stat-Led */}
      <main className="lp-hero">
        <div className="lp-hero-copy">
          <span className="mono-label">JEE Main · NEET UG · Mock CBT</span>
          <h1 className="lp-h1">180 minutes, <span className="hl">rehearsed.</span></h1>
          <p className="lp-sub">
            World of Physics rebuilds the JEE and NEET computer-based test — the same screen,
            the same timer, the same palette — so exam day holds no surprises.
          </p>

          <div className="lp-code" aria-label="Enter your test code">
            <span className="mono-label lp-code-label">Enter your test code</span>
            {codeForm}
            <a className="btn btn--cyan lp-code-sheets" href="/course">
              Download Formulas
            </a>
            <p className="lp-code-note">Codes are issued by {siteInfo.contactName} before each mock. Case-insensitive.</p>
          </div>
        </div>

        <div className="lp-figure-wrap" aria-hidden="true">
          <div className="lp-sticker"><span>NTA-style<br />CBT<br />Rehearsed</span></div>
          <div className="lp-figure">
            <div className="lp-figure-num">180<small>min</small></div>
            <div className="lp-figure-cap">One sitting · same as the real day</div>
            <div className="lp-figure-sub">JEE Main · NEET UG · Physics — the full syllabus</div>
          </div>
        </div>
      </main>

      {/* Interface band */}
      <section className="lp-band" id="interface" aria-labelledby="interface-heading">
        <div className="lp-band-inner">
          <div>
            <span className="mono-label">The interface</span>
            <h2 id="interface-heading">The screen you will stare at for <span className="hl" style={{ "--hl": "oklch(66% 0.18 235 / 0.35)" } as React.CSSProperties}>three hours</span>.</h2>
            <p>
              Every button, every timer tick, every palette colour — rebuilt by hand from the
              real NTA portal. When the actual exam opens, your hands already know where to go.
            </p>
            <ol className="lp-steps">
              <li className="lp-step"><span className="lp-step-num">01 · GET</span><span><strong>Get your code.</strong> Issued by {siteInfo.contactName} before each mock.</span></li>
              <li className="lp-step"><span className="lp-step-num">02 · ENTER</span><span><strong>Type the code above.</strong> Case doesn&apos;t matter. PHY_JEE_2026_04 works.</span></li>
              <li className="lp-step"><span className="lp-step-num">03 · SIT</span><span><strong>Sit the mock like it&apos;s the day.</strong> Timer, palette and all — then review where you bled time.</span></li>
            </ol>
          </div>

          <figure style={{ margin: 0, minWidth: 0 }}>
            <div className="lp-cbt" role="img" aria-label="The actual portal screen: navy header with exam title and timer, question 24 of 90 with four options, and the question palette with colour-coded states on the right">
              <div className="lp-cbt-header">
                <div>
                  <div className="lp-cbt-org">World of Physics · Online Examination</div>
                  <div className="lp-cbt-exam">JEE Main 2026 · Physics Mock IV</div>
                  <div className="lp-cbt-sub">Subject: Physics &nbsp;·&nbsp; Code: PHY_JEE_2026_04</div>
                </div>
                <div className="lp-cbt-hr">
                  <div className="lp-cbt-cand">
                    <div className="lp-cbt-avatar" aria-hidden="true">RS</div>
                    <div className="lp-cbt-cmeta">
                      <span className="lp-cbt-clabel">Candidate Name</span>
                      <span className="lp-cbt-cname">Rohan Sharma</span>
                    </div>
                  </div>
                  <div className="lp-cbt-timer">
                    <span className="lp-cbt-tlabel">Time Left</span>
                    <span className="lp-cbt-tval">02:14:37</span>
                  </div>
                </div>
              </div>
              <nav className="lp-cbt-tabs" aria-hidden="true">
                <span className="lp-cbt-tab active">Physics<i className="lp-cbt-tabn">90</i></span>
                <span className="lp-cbt-tinfo">Marking: +4 / −1 &nbsp;·&nbsp; MCQ (single correct)</span>
              </nav>
              <div className="lp-cbt-main">
                <section className="lp-cbt-qcol">
                  <div className="lp-cbt-qhead">
                    <div className="lp-cbt-qno">Question No. 24 <span className="lp-cbt-flag">⚑ Marked for Review</span></div>
                    <div className="lp-cbt-marks"><span className="lp-cbt-chip pos">+4</span><span className="lp-cbt-chip neg">−1</span></div>
                  </div>
                  <div className="lp-cbt-qbody">
                    <p className="lp-cbt-qtext">A thin uniform rod of length <span className="var">L</span> and mass <span className="var">M</span> rotates about a perpendicular axis through one end. Its moment of inertia is:</p>
                    <div className="lp-cbt-opts">
                      <div className="lp-cbt-opt"><span className="lp-cbt-radio" /><span className="lp-cbt-okey">A.</span><span className="lp-cbt-ot">ML² / 12</span></div>
                      <div className="lp-cbt-opt"><span className="lp-cbt-radio" /><span className="lp-cbt-okey">B.</span><span className="lp-cbt-ot">ML² / 6</span></div>
                      <div className="lp-cbt-opt sel"><span className="lp-cbt-radio" /><span className="lp-cbt-okey">C.</span><span className="lp-cbt-ot">ML² / 3</span></div>
                      <div className="lp-cbt-opt"><span className="lp-cbt-radio" /><span className="lp-cbt-okey">D.</span><span className="lp-cbt-ot">ML²</span></div>
                    </div>
                  </div>
                  <footer className="lp-cbt-actions">
                    <div className="lp-cbt-agroup">
                      <span className="lp-cbt-btn mark">Mark for Review &amp; Next</span>
                      <span className="lp-cbt-btn ghost">Clear Response</span>
                    </div>
                    <div className="lp-cbt-agroup">
                      <span className="lp-cbt-btn ghost">&lt; Back</span>
                      <span className="lp-cbt-btn save">Save &amp; Next</span>
                    </div>
                  </footer>
                </section>
                <aside className="lp-cbt-side" aria-hidden="true">
                  <div className="lp-cbt-legend">
                    <div className="lp-cbt-legend-title">Legend</div>
                    <div className="lp-cbt-lgrid">
                      <span className="lp-cbt-lg"><i className="un">1</i>Not Visited</span>
                      <span className="lp-cbt-lg"><i className="no">2</i>Not Answered</span>
                      <span className="lp-cbt-lg"><i className="ans">3</i>Answered</span>
                      <span className="lp-cbt-lg"><i className="mk">4</i>Marked for Review</span>
                      <span className="lp-cbt-lg wide"><i className="mkans">5</i><span>Answered &amp; Marked for Review<em>(will be considered for evaluation)</em></span></span>
                    </div>
                  </div>
                  <div className="lp-cbt-ptitle">Physics — Section A</div>
                  <div className="lp-cbt-pal">
                    {["ans","ans","un","ans","no","ans","mk","ans","ans","un","ans","mkans","ans","ans","no","ans","ans","un","ans","mk","ans","ans","ans","mkans","cur"].map((s, i) => (
                      <span key={i} className={`lp-cbt-pb ${s === "cur" ? "ans cur" : s}`}>{i + 1}</span>
                    ))}
                  </div>
                  <div className="lp-cbt-sum"><span><b>17</b> answered</span><span><b>3</b> not answered</span><span><b>4</b> marked</span></div>
                  <div className="lp-cbt-foot">
                    <span className="lp-cbt-btn ghost">Instructions</span>
                    <span className="lp-cbt-btn submit">Submit</span>
                  </div>
                </aside>
              </div>
            </div>
            <figcaption className="lp-cbt-cap">The actual portal, rebuilt for this preview</figcaption>
          </figure>
        </div>
      </section>

      {/* Formula sheets strip */}
      <section className="lp-strip" aria-labelledby="sheets-heading">
        <div>
          <span className="mono-label">Formula sheets</span>
          <h2 id="sheets-heading">Every formula, <span className="hl" style={{ "--hl": "oklch(66% 0.18 235 / 0.35)" } as React.CSSProperties}>one page each</span>.</h2>
          <p>Class 11 and 12 Physics — Mechanics, Thermodynamics, Waves, Optics, Modern Physics and more, arranged grade by grade.</p>
        </div>
        <a href="/course" className="btn btn--cyan">Browse the sheets</a>
      </section>

      {/* Footer · Ft8 */}
      <footer className="lp-foot">
        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">
            <span>World of Physics <b>·</b> Practice like it&apos;s the day <b>·</b> World of Physics <b>·</b> </span>
            <span>World of Physics <b>·</b> Practice like it&apos;s the day <b>·</b> World of Physics <b>·</b> </span>
          </div>
        </div>
        <p className="visually-hidden">World of Physics · practice like it is the day. Not affiliated with NTA.</p>
        <div className="lp-foot-meta">
          <span>© 2026 {siteInfo.contactName} · Not affiliated with NTA</span>
          <nav className="lp-foot-links" aria-label="Footer">
            <a href="/course">Formula Sheets</a>
            <a href="/account">Account</a>
            <a href="/admin">Admin</a>
            <a href="/privacy-policy">Privacy</a>
            <a href="/terms-of-service">Terms</a>
            <a href="https://teamobliq.in" target="_blank" rel="noopener noreferrer">Team Obliq.</a>
          </nav>
        </div>
      </footer>

      {/* Dialog */}
      {dialogOpen && (
        <div className="lp-overlay" onClick={closeDialog}>
          <div
            className="lp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-code-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="lp-dialog-close" onClick={closeDialog} aria-label="Close">×</button>
            <h3 id="test-code-dialog-title">Enter your test code</h3>
            <p>Codes are issued by {siteInfo.contactName} before each mock. Case-insensitive.</p>
            {codeForm}
          </div>
        </div>
      )}

      {/* Phone OTP sign-in dialog */}
      {authDialogOpen && (
        <PhoneAuth dialog onClose={() => setAuthDialogOpen(false)} />
      )}
    </div>
  );
}
