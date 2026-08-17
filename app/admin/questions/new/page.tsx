"use client";

import { useEffect, useState } from "react";
import { addQuestion as saveQuestion, fetchQuestions } from "@/lib/questions";
import QuestionEditor from "../editor";

export default function NewQuestionPage() {
  const [existingChapters, setExistingChapters] = useState<string[]>([]);

  useEffect(() => {
    fetchQuestions()
      .then((qs) => {
        const chapters = Array.from(
          new Set(qs.map((q) => q.chapter?.trim()).filter((c): c is string => Boolean(c)))
        ).sort((a, b) => a.localeCompare(b));
        setExistingChapters(chapters);
      })
      .catch(() => {});
  }, []);

  return (
    <QuestionEditor
      title="New Question"
      subtitle="Build your question on the left — the preview updates live on the right."
      onSave={saveQuestion}
      existingChapters={existingChapters}
    />
  );
}