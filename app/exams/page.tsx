"use client";

import { useState } from "react";
import Link from "next/link";

interface TakenExam {
  id: string;
  title: string;
  subject: string;
  takenOn: string;
  score: number;
  total: number;
  duration: string;
  status: "completed" | "in-progress" | "missed";
}

const TAKEN_EXAMS: TakenExam[] = [
  {
    id: "jee-2026-mock-iv",
    title: "JEE Main 2026 · Mock IV",
    subject: "Physics",
    takenOn: "Aug 09, 2026",
    score: 214,
    total: 300,
    duration: "3h 00m",
    status: "completed",
  },
  {
    id: "neet-bio-practice-12",
    title: "NEET Biology · Practice Set 12",
    subject: "Biology",
    takenOn: "Aug 07, 2026",
    score: 642,
    total: 720,
    duration: "3h 20m",
    status: "completed",
  },
  {
    id: "jee-math-sprint-03",
    title: "JEE Math · Sprint 03",
    subject: "Mathematics",
    takenOn: "Aug 05, 2026",
    score: 61,
    total: 100,
    duration: "1h 30m",
    status: "completed",
  },
  {
    id: "neet-chem-full",
    title: "NEET Chemistry · Full Syllabus",
    subject: "Chemistry",
    takenOn: "Aug 02, 2026",
    score: 138,
    total: 180,
    duration: "2h 00m",
    status: "in-progress",
  },
  {
    id: "jee-2025-paper",
    title: "JEE Advanced 2025 · Paper 1",
    subject: "Mixed",
    takenOn: "Jul 28, 2026",
    score: 0,
    total: 264,
    duration: "3h 00m",
    status: "missed",
  },
];

const STATUS_META: Record<TakenExam["status"], { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-green-100 text-green-800" },
  "in-progress": { label: "In progress", cls: "bg-amber-100 text-amber-800" },
  missed: { label: "Missed", cls: "bg-red-100 text-red-800" },
};

export default function ExamsPage() {
  const [query, setQuery] = useState("");

  const filtered = TAKEN_EXAMS.filter((e) =>
    `${e.title} ${e.subject}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      <header className="bg-[#faf8ff] border-b border-[#d2d9f4]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[#131b2e]">
            EduTest Pro
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Home
            </Link>
            <a href="/dashboard" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Dashboard
            </a>
            <a href="/exams" className="text-[#131b2e] hover:text-[#2563eb] transition-colors font-medium">
              Exams
            </a>
            <a href="/results" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Results
            </a>
            <a href="/create" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Create Exam
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1 pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-[#131b2e]">Your Exams</h1>
              <p className="text-lg text-[#434655]">
                Every test you&apos;ve taken, rehearsed, and reviewed.
              </p>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exams…"
              className="input-field sm:w-64"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="card text-center text-[#64748b]">
              No exams match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((exam) => {
                const pct = exam.total ? Math.round((exam.score / exam.total) * 100) : 0;
                const meta = STATUS_META[exam.status];
                return (
                  <li key={exam.id}>
                    <div className="card flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-md transition-shadow duration-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="text-xl font-semibold text-[#131b2e] truncate">
                            {exam.title}
                          </h2>
                          <span className={`badge ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-[#64748b]">
                          <span>Subject: <span className="text-[#2563eb]">{exam.subject}</span></span>
                          <span>Taken: {exam.takenOn}</span>
                          <span>Duration: {exam.duration}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 sm:border-l sm:border-[#d2d9f4] sm:pl-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#131b2e]">{pct}%</div>
                          <div className="text-xs text-[#64748b]">
                            {exam.score}/{exam.total}
                          </div>
                        </div>
                        <Link
                          href={exam.status === "missed" ? "/exams" : "/results"}
                          className="btn btn-secondary whitespace-nowrap"
                        >
                          {exam.status === "completed" ? "View Result" : exam.status === "in-progress" ? "Resume" : "Retake"}
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <footer className="bg-[#faf8ff] border-t border-[#d2d9f4] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm text-[#64748b]">
          <p>© 2026 EduTest Pro. All rights reserved.</p>
        </div>
      </footer>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Link
          href="/create"
          className="btn btn-primary shadow-lg flex items-center gap-2 px-6 py-3 text-base"
        >
          <span className="text-xl leading-none">+</span> New Test
        </Link>
      </div>
    </>
  );
}
