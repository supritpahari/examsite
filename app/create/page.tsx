import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create Exam",
  description: "Create a new examination with custom questions and settings.",
};

export default function CreateExamPage() {
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
            <Link href="/results" className="text-[#131b2e] hover:text-[#2563eb] transition-colors">
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
          <h1 className="text-4xl font-bold mb-4 text-[#131b2e]">Create New Exam</h1>
          <p className="text-lg text-[#434655] mb-8">
            Set up a new examination with custom questions, time limits, and settings.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Exam Configuration</h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Exam Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                    placeholder="Enter exam name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Description</label>
                  <textarea
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb] h-20 resize-none"
                    placeholder="Describe the exam..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Number of Questions</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                    placeholder="20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Exam Type</label>
                  <select className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]">
                    <option>Multiple Choice</option>
                    <option>True / False</option>
                    <option>Short Answer</option>
                    <option>Essay</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Passing Score (%)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                    placeholder="50"
                  />
                </div>
              </form>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold mb-2 text-[#131b2e]">Question Builder</h2>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Question Prompt</label>
                  <textarea
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb] h-20 resize-none"
                    placeholder="Enter the question prompt..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Question Type</label>
                  <select className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]">
                    <option>Multiple Choice</option>
                    <option>True / False</option>
                    <option>Short Answer</option>
                    <option>Essay</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Options (for Multiple Choice)</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                        placeholder="Option A"
                      />
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                        placeholder="Option B"
                      />
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                        placeholder="Option C"
                      />
                      <input
                        type="text"
                        className="flex-1 px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                        placeholder="Option D"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Correct Answer</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                    placeholder="Correct answer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#131b2e] mb-1">Image (optional)</label>
                  <input
                    type="file"
                    className="w-full px-4 py-2 border border-[#d2d9f4] rounded-lg bg-[#faf8ff] text-[#131b2e] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </form>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <Link href="/dashboard" className="btn btn-secondary">
              Cancel
            </Link>
            <Link href="/exams" className="btn btn-primary">
              Save Exam
            </Link>
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