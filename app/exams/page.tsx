import Link from "next/link";

export default function ExamsPage() {
  return (
    <>
      <header className="bg-[#faf8ff] border-b border-[#d2d9f4]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-[#131b2e]">
            EduTest Pro
          </a>
          <div className="flex gap-6">
            <a href="/" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Home
            </a>
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

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-4xl font-bold mb-4 text-[#131b2e]">Exams</h1>
          <p className="text-lg text-[#434655] mb-8">
            Browse and manage your available exams.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Advanced Calculus Midterm</h2>
              <p className="text-[#434655] mb-4">Test your knowledge of calculus concepts and problem-solving skills.</p>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Duration</span>
                <span className="text-[#2563eb]">60 min</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Questions</span>
                <span className="text-[#2563eb]">45</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-[#434655]">Difficulty</span>
                <span className="text-[#2563eb]">Hard</span>
              </div>
              <a href="/exams/calculus-midterm" className="btn btn-primary w-full">
                Start Exam
              </a>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Intro to Physics Q3</h2>
              <p className="text-[#434655] mb-4">Fundamental physics concepts and problem-solving exercises.</p>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Duration</span>
                <span className="text-[#2563eb]">45 min</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Questions</span>
                <span className="text-[#2563eb]">30</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-[#434655]">Difficulty</span>
                <span className="text-[#2563eb]">Medium</span>
              </div>
              <a href="/exams/physics-q3" className="btn btn-primary w-full">
                Start Exam
              </a>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">European History Final</h2>
              <p className="text-[#434655] mb-4">Comprehensive assessment of European historical events and analysis.</p>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Duration</span>
                <span className="text-[#2563eb]">90 min</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#434655]">Questions</span>
                <span className="text-[#2563eb]">60</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-[#434655]">Difficulty</span>
                <span className="text-[#2563eb]">Hard</span>
              </div>
              <a href="/exams/history-final" className="btn btn-primary w-full">
                Start Exam
              </a>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Create New Exam</h2>
            <p className="text-[#434655] mb-4">
              Build a custom exam with your own questions and settings.
            </p>
            <div className="flex gap-4">
              <Link href="/create" className="btn btn-primary">
                Create Exam
              </Link>
              <Link href="/dashboard" className="btn btn-secondary">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#faf8ff] border-t border-[#d2d9f4] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm text-[#64748b]">
          <p>© 2026 EduTest Pro. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}