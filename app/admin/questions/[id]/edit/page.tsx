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
        style={
          {
            "--paper": "#f4f0e8",
            "--ink": "#14110d",
            "--dim": "#8a8275",
            "--rule": "#d9d1bf",
          } as React.CSSProperties
        }
      >
        <style>{`
          .nq-load {
            min-height: 100vh; display: grid; place-items: center; background: var(--paper);
            color: var(--dim); font-family: 'JetBrains Mono', monospace; font-size: 12px;
            text-transform: uppercase; letter-spacing: 0.16em;
          }
          .nq-load a { color: var(--ink); }
        `}</style>
        <div className="nq-load">
          {status === "missing" ? (
            <span>Question not found — <a href="/admin">back to questions</a></span>
          ) : (
            <span>Loading question…</span>
          )}
        </div>
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