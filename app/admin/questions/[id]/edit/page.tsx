/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchQuestion,
  updateQuestion,
  type Question,
} from "@/lib/questions";
import QuestionEditor from "../../editor";

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [question, setQuestion] = useState<Question | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (!id) return;
    fetchQuestion(id)
      .then((q) => {
        if (q) {
          setQuestion(q);
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      })
      .catch(() => setStatus("missing"));
  }, [id]);

  if (status !== "ready" || !question) {
    return (
      <div
        style={{
          minHeight: "100vh", display: "grid", placeItems: "center",
          background: "var(--color-paper)", color: "var(--color-muted)",
          fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 500,
          textTransform: "uppercase", letterSpacing: "0.18em",
        }}
      >
          {status === "missing" ? (
            <span>Question not found — <a href="/admin" style={{ color: "var(--color-accent-2-deep)" }}>back to questions</a></span>
          ) : (
            <span>Loading question…</span>
          )}
      </div>
    );
  }

  return (
    <QuestionEditor
      initial={question}
      title="Edit Question"
      subtitle="Edit the question on the left — the preview updates live on the right."
      onSave={(data) => updateQuestion(id, data)}
      backHref="/admin"
    />
  );
}