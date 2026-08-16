import Link from "next/link";

export default function ResultsPage() {
  return (
    <>
      <header className="bg-[#faf8ff] border-b border-[#d2d9f4]">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[#131b2e]">
            World of Physics
          </Link>
          <div className="flex gap-6">
            <Link href="/" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Home
            </Link>
            <Link href="/dashboard" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Dashboard
            </Link>
            <Link href="/results" className="text-[#131b2e] hover:text-[#2563eb] transition-colors font-medium">
              Results
            </Link>
            <Link href="/exams" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
              Exams
            </Link>
            <Link href="/create" className="text-[#131b2e] hover:text-[#2563eb] transition-colors font-medium">
              Create Exam
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-4xl font-bold mb-4 text-[#131b2e]">Results & Analytics</h1>
          <p className="text-lg text-[#434655] mb-8">
            View your exam results, performance trends, and detailed analytics.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Performance Overview</h2>
              <p className="text-[#434655]">Analyze your results across multiple exams.</p>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">Overall Score</span>
                  <span className="text-[#2563eb]">87%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-[#434655]">Average Time</span>
                  <span className="text-[#2563eb]">28m 45s</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-[#434655]">Pass Rate</span>
                  <span className="text-[#2563eb]">92%</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-[#434655]">Highest Score</span>
                  <span className="text-[#2563eb]">95%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Recent Attempts</h2>
              <p className="text-[#434655]">Latest exam performances.</p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">Advanced Calculus Midterm</span>
                  <span className="text-[#2563eb]">92%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#434655]">Intro to Physics Q3</span>
                  <span className="text-[#2563eb]">85%</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-[#434655]">European History Final</span>
                  <span className="text-[#2563eb]">88%</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Statistics</h2>
              <p className="text-[#434655]">Detailed performance metrics.</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-[#2563eb] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-.89 0-1.76-.18-2.5-.5a.75.75 0 01.43-.89c.5.89 1.12 1.5 1.5 1.89a.75.75 0 01-.89.43c-.89.5-1.76.18-2.5-.5" />
                  </svg>
                  <span className="text-[#434655]">Completion Rate</span>
                  <span className="text-[#2563eb] font-medium">89%</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-[#2563eb] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-12v6m12 0h-6" />
                  </svg>
                  <span className="text-[#434655]">Average Score</span>
                  <span className="text-[#2563eb] font-medium">87</span>
                </div>
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-[#2563eb] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-12v6m12 0h-6" />
                  </svg>
                  <span className="text-[#434655]">Standard Deviation</span>
                  <span className="text-[#2563eb] font-medium">4.2</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Export Data</h2>
            <p className="text-[#434655] mb-4">
              Export your results and analytics for further analysis.
            </p>
            <div className="flex gap-3">
              <a href="#" className="btn btn-secondary">
                Export as PDF
              </a>
              <a href="#" className="btn btn-secondary">
                Export as CSV
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#faf8ff] border-t border-[#d2d9f4] py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm text-[#64748b]">
          <p>© 2026 World of Physics. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}