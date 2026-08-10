import Link from "next/link";

export default function DashboardPage() {
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
            <a href="/dashboard" className="text-[#131b2e] hover:text-[#2563eb] transition-colors font-medium">
              Dashboard
            </a>
            <a href="/results" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Results
            </a>
            <a href="/exams" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Exams
            </a>
            <a href="/create" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Create Exam
            </a>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-4xl font-bold mb-4 text-[#131b2e]">Dashboard</h1>
          <p className="text-lg text-[#434655] mb-8">
            Overview of your exams, progress, and recent results.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Active Exams</h2>
              <p className="text-[#434655]">24 active exams with 1,240 total candidates.</p>
              <div className="mt-4">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "78%" }}></div>
                </div>
                <p className="text-sm text-[#64748b] mt-1">89% avg. completion rate</p>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Recent Results</h2>
              <p className="text-[#434655]">Latest scores and performance data.</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">AK Alex Kim</span>
                  <span className="text-[#2563eb]">Advanced Calculus Midterm - 92%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">SJSam Johnson</span>
                  <span className="text-[#2563eb]">Intro to Physics Q3 - 85%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">MR Maria Rossi</span>
                  <span className="text-[#2563eb]">Advanced Calculus Midterm - 64%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">LTLiam Turner</span>
                  <span className="text-[#2563eb]">European History Final - 88%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Upcoming Tests</h2>
              <p className="text-[#434655]">Scheduled exams and deadlines.</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">Organic Chemistry 101 - Final</span>
                  <span className="text-[#64748b]">OCT26, 14:00 - 16:30 EST</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">Intro to Psychology Quiz 4</span>
                  <span className="text-[#64748b]">OCT24, 09:00 - 10:00 EST</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
              <Link href="/exams" className="btn btn-primary">
                Start New Exam
              </Link>
              <Link href="/results" className="btn btn-secondary">
                View Results
              </Link>
              <Link href="/create" className="btn btn-secondary">
                Create Exam
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