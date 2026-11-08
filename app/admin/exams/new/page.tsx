/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { fetchQuestions, type Question } from "@/lib/questions";
import ExamCreator from "../editor";

export default function NewExamPage() {
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    fetchQuestions()
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, []);

  return <ExamCreator questions={questions} backHref="/admin" />;
}