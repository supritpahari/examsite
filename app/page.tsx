"use client";

import { useState } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

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

        .v2-hero {
          padding: 80px 48px 48px;
          text-align: center;
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
        }

        .v2-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.24em;
          text-transform: uppercase;
          margin-bottom: 32px;
          display: inline-flex;
          align-items: center;
          gap: 14px;
        }

        .v2-eyebrow::before, .v2-eyebrow::after { content: ""; width: 24px; height: 1px; background: var(--accent); }

        .v2-h1 {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(56px, 8.5vw, 128px);
          color: #14110d;
          line-height: 0.92;
          letter-spacing: -0.025em;
          font-weight: 400;
          margin: 0 auto 32px;
          max-width: 12ch;
        }

        .v2-h1 em { font-style: italic; color: var(--accent); }

        .v2-sub {
          font-size: 19px;
          line-height: 1.55;
          color: var(--ink-2);
          max-width: 560px;
          margin: 0 auto 48px;
        }

        .v2-cta-frame {
          max-width: 540px;
          margin: 0 auto;
          background: var(--paper);
          border: 1px solid var(--ink);
          position: relative;
          padding: 32px 32px 28px;
          text-align: left;
        }

        .v2-cta-frame::before, .v2-cta-frame::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          background: var(--ink);
        }

        .v2-cta-frame::before { top: -1px; left: -1px; }
        .v2-cta-frame::after { bottom: -1px; right: -1px; }

        .v2-cta-num {
          position: absolute;
          top: -14px;
          left: 24px;
          background: var(--paper);
          padding: 0 10px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--ink);
        }

        .v2-cta-title {
          font-family: 'Instrument Serif', serif;
          font-size: 24px;
          line-height: 1.2;
          margin: 0 0 4px;
          color: #14110d;
        }

        .v2-cta-title em { font-style: italic; color: var(--accent); }

        .v2-cta-desc {
          font-size: 13px;
          color: var(--dim);
          margin: 0 0 22px;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 0.02em;
        }

        .v2-cta-row {
          display: flex;
          align-items: stretch;
          gap: 10px;
        }

        .v2-cta-row input {
          flex: 1;
          background: transparent;
          border: 1px solid var(--ink);
          border-radius: 0;
          padding: 16px 18px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 18px;
          letter-spacing: 0.18em;
          color: var(--ink);
          outline: none;
          text-transform: uppercase;
        }

        .v2-cta-row input::placeholder { color: #b8ad96; }
        .v2-cta-row input:focus { background: #fff; }

        .v2-cta-row button {
          background: var(--accent);
          color: #fff;
          border: 1px solid var(--accent);
          padding: 0 24px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
        }

        .v2-cta-row button:hover { background: var(--accent-2); border-color: var(--accent-2); }

        .v2-sec-rule {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 64px 48px 20px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink);
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .v2-sec-rule::before, .v2-sec-rule::after { content: ""; flex: 1; height: 1px; background: var(--rule); }

        .v2-preview-wrap {
          padding: 0 48px 64px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .v2-preview {
          border: 1px solid var(--ink);
          background: #0f0d0a;
          color: #eee6d5;
          position: relative;
          box-shadow: 12px 12px 0 var(--ink);
        }

        .v2-preview-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 18px;
          background: #14110d;
          border-bottom: 1px solid #2a251d;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #b8ad96;
          letter-spacing: 0.06em;
        }

        .v2-preview-body { display: grid; grid-template-columns: 1fr 240px; }

        .v2-q2 { padding: 32px 32px 28px; border-right: 1px solid #2a251d; }

        .v2-q2-meta {
          display: flex;
          justify-content: space-between;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #b8ad96;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 18px;
        }

        .v2-q2-meta strong { color: var(--accent); }

        .v2-q2-text {
          font-family: 'Instrument Serif', serif;
          font-size: 20px;
          line-height: 1.45;
          color: #f4ecd8;
          margin: 0 0 24px;
        }

        .v2-q2-text .var { color: var(--accent); font-style: italic; }

        .v2-opts2 { display: flex; flex-direction: column; gap: 8px; }

        .v2-opt2 {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 14px;
          border: 1px solid #2a251d;
        }

        .v2-opt2.sel { border-color: var(--accent); background: rgba(200,50,30,0.08); }

        .v2-opt2-k {
          width: 26px;
          height: 26px;
          border: 1px solid #2a251d;
          display: grid;
          place-items: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #b8ad96;
        }

        .v2-opt2.sel .v2-opt2-k { background: var(--accent); border-color: var(--accent); color: #fff; }

        .v2-opt2-t { font-family: 'JetBrains Mono', monospace; font-size: 13px; }

        .v2-side2 { padding: 22px 20px; background: #0b0908; }

        .v2-tlabel { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8a8275; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 8px; }
        .v2-tval { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 500; color: var(--accent); letter-spacing: 0.02em; margin-bottom: 22px; }

        .v2-pal { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-bottom: 18px; }

        .v2-pdot2 { aspect-ratio: 1; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 10px; }

        .v2-pdot2.ans { background: var(--accent); color: #fff; }
        .v2-pdot2.mk  { background: #d9a300; color: #14110d; }
        .v2-pdot2.vis { background: #4a2a14; color: #f4ecd8; }
        .v2-pdot2.un  { background: transparent; color: #8a8275; border: 1px solid #2a251d; }

        .v2-foot {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          align-items: start;
          padding: 56px 48px 32px;
          gap: 40px;
          border-top: 1px solid var(--rule);
        }

        .v2-foot-title { font-family: 'Instrument Serif', serif; font-size: 40px; line-height: 1; letter-spacing: -0.02em; margin-bottom: 16px; }
        .v2-foot-title em { font-style: italic; color: var(--accent); }
        .v2-foot-blurb { font-size: 14px; line-height: 1.6; color: var(--ink-2); max-width: 32ch; }

        .v2-foot-col h4 {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--accent);
          margin: 0 0 14px;
        }

        .v2-foot-col a, .v2-foot-col p {
          display: block;
          font-size: 14px;
          line-height: 1.9;
          color: var(--ink-2);
          text-decoration: none;
        }
        .v2-foot-col a:hover { color: var(--accent); }

        .v2-foot-bottom {
          grid-column: 1 / -1;
          border-top: 1px dashed var(--rule);
          margin-top: 24px;
          padding-top: 20px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--dim);
          display: flex;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .v2-overlay {
          position: fixed;
          inset: 0;
          background: rgba(20, 17, 13, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1000;
        }

        .v2-dialog {
          width: 100%;
          max-width: 540px;
          background: var(--paper);
          border: 1px solid var(--ink);
          position: relative;
          padding: 40px 32px 28px;
          text-align: left;
          box-shadow: 12px 12px 0 var(--ink);
        }

        .v2-dialog::before, .v2-dialog::after {
          content: "";
          position: absolute;
          width: 12px;
          height: 12px;
          background: var(--ink);
        }
        .v2-dialog::before { top: -1px; left: -1px; }
        .v2-dialog::after { bottom: -1px; right: -1px; }

        .v2-dialog-close {
          position: absolute;
          top: 14px;
          right: 16px;
          background: transparent;
          border: 1px solid var(--ink);
          width: 30px;
          height: 30px;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          color: var(--ink);
        }
        .v2-dialog-close:hover { background: var(--ink); color: var(--paper); }

        .v2-watermark {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.15s ease;
        }
        .v2-watermark:hover { border-color: currentColor; }

        @media (max-width: 960px) {
          .v2-hero, .v2-preview-wrap, .v2-sec-rule, .v2-foot { padding-left: 24px; padding-right: 24px; }
          .v2-preview-body { grid-template-columns: 1fr; }
          .v2-q2 { border-right: 0; border-bottom: 1px solid #2a251d; }
          .v2-foot { grid-template-columns: 1fr; gap: 28px; }
        }
      `}</style>

      <section className="v2-hero">
        <div className="v2-eyebrow">The Real Portal — Rehearsed</div>
        <h1 className="v2-h1">The exam <em>before</em> the exam.</h1>
        <p className="v2-sub">
          ExamSite is a faithful reproduction of the JEE and NEET computer-based
          test portals — every button, every timer, every keystroke.
          You will not be surprised on the day that matters.
        </p>

        <div className="v2-cta-frame">
          <div className="v2-cta-num">§ 01 · Entrance</div>
          <h3 className="v2-cta-title">Enter your <em>test code</em></h3>
          <p className="v2-cta-desc">Codes are issued by Mr. Biman Dhawa before each mock. Case-insensitive.</p>
          <form className="v2-cta-row" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="PHY-JEE-2026-04"
              maxLength={18}
              spellCheck={false}
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit">Begin →</button>
          </form>
        </div>
      </section>

      <div className="v2-sec-rule"><span>§ 02 · The Interface</span></div>

      <div className="v2-preview-wrap">
        <div className="v2-preview">
          <div className="v2-preview-bar">
            <span>NTA CBT · JEE MAIN 2026 · MOCK IV</span>
            <span>Candidate: R. Sharma · Roll 24011745</span>
            <span style={{ color: "#d9a300" }}>● Recording</span>
          </div>
          <div className="v2-preview-body">
            <div className="v2-q2">
              <div className="v2-q2-meta">
                <span>Section A · Physics</span>
                <span><strong>Q. 24</strong> of 90</span>
              </div>
              <p className="v2-q2-text">
                A thin uniform rod of length <span className="var">L</span> and mass <span className="var">M</span>
                rotates about a perpendicular axis through one end. Its moment of inertia is:
              </p>
              <div className="v2-opts2">
                <div className="v2-opt2"><div className="v2-opt2-k">A</div><div className="v2-opt2-t">ML² / 12</div></div>
                <div className="v2-opt2"><div className="v2-opt2-k">B</div><div className="v2-opt2-t">ML² / 6</div></div>
                <div className="v2-opt2 sel"><div className="v2-opt2-k">C</div><div className="v2-opt2-t">ML² / 3</div></div>
                <div className="v2-opt2"><div className="v2-opt2-k">D</div><div className="v2-opt2-t">ML²</div></div>
              </div>
            </div>
            <aside className="v2-side2">
              <div className="v2-tlabel">Time remaining</div>
              <div className="v2-tval">02:14:37</div>
              <div className="v2-tlabel">Palette · Section A</div>
              <div className="v2-pal">
                <div className="v2-pdot2 ans">1</div><div className="v2-pdot2 ans">2</div><div className="v2-pdot2 vis">3</div>
                <div className="v2-pdot2 ans">4</div><div className="v2-pdot2 mk">5</div><div className="v2-pdot2 ans">6</div>
                <div className="v2-pdot2 un">7</div><div className="v2-pdot2 ans">8</div><div className="v2-pdot2 mk">9</div>
                <div className="v2-pdot2 ans">10</div><div className="v2-pdot2 ans">11</div><div className="v2-pdot2 ans">12</div>
                <div className="v2-pdot2 vis">13</div><div className="v2-pdot2 ans">14</div><div className="v2-pdot2 ans">15</div>
                <div className="v2-pdot2 mk">16</div><div className="v2-pdot2 ans">17</div><div className="v2-pdot2 ans">18</div>
                <div className="v2-pdot2 un">19</div><div className="v2-pdot2 vis">20</div><div className="v2-pdot2 ans">21</div>
                <div className="v2-pdot2 ans">22</div><div className="v2-pdot2 mk">23</div>
                <div className="v2-pdot2 ans" style={{ outline: "2px solid #f4ecd8", outlineOffset: 1 }}>24</div>
              </div>
              <div className="v2-tlabel" style={{ marginBottom: 6 }}>Legend</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "9.5px", color: "#8a8275", display: "flex", flexDirection: "column", gap: 4 }}>
                <span><i style={{ width: 8, height: 8, background: "oklch(0.52 0.20 25)", display: "inline-block", marginRight: 6 }}></i>Answered</span>
                <span><i style={{ width: 8, height: 8, background: "#d9a300", display: "inline-block", marginRight: 6 }}></i>Marked</span>
                <span><i style={{ width: 8, height: 8, background: "#4a2a14", display: "inline-block", marginRight: 6 }}></i>Visited</span>
                <span><i style={{ width: 8, height: 8, border: "1px solid #2a251d", display: "inline-block", marginRight: 6 }}></i>Not visited</span>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <footer className="v2-foot">
        <div>
          <div className="v2-foot-title">Practice like it&apos;s <em>the day</em>.</div>
          <p className="v2-foot-blurb">
            ExamSite is a faithful rehearsal of the JEE &amp; NEET computer-based
            test portals — built by Mr. Biman Dhawa to take the surprise out of exam day.
          </p>
        </div>
        <div className="v2-foot-col">
          <h4>Portal</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); openDialog(); }}>Take your test</a>
          <a href="/admin">Admin</a>
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
        </div>
        <div className="v2-foot-col">
          <h4>Contact</h4>
          <p>Mr. Biman Dhawa · Physics</p>
          <p>Belda, IN</p>
          <a href="mailto:hello@examsite.in">hello@examsite.in</a>
          <a href="#">+91 00000 00000</a>
        </div>
        <div className="v2-foot-bottom">
          <span>ExamSite · © 2026 Mr. Biman Dhawa</span>
          <a href="https://obliqllc.xyz" target="_blank" rel="noopener noreferrer" className="v2-watermark">Developed by Team Obliq. · obliqllc.xyz</a>
          <span>Not affiliated with NTA · For practice only</span>
        </div>
      </footer>

      {dialogOpen && (
        <div className="v2-overlay" onClick={closeDialog}>
          <div className="v2-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="v2-dialog-close" onClick={closeDialog} aria-label="Close">×</button>
            <h3 className="v2-cta-title">Enter your <em>test code</em></h3>
            <p className="v2-cta-desc">Codes are issued by Mr. Biman Dhawa before each mock. Case-insensitive.</p>
            <form className="v2-cta-row" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="PHY-JEE-2026-04"
                maxLength={18}
                spellCheck={false}
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="submit">Begin →</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
