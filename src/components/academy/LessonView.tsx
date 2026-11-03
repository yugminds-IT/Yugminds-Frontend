"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { academy, type PlayerLesson, type ProgressResult } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { sanitizeHtml } from "@/lib/sanitize-html";

/** YouTube / Vimeo page URL → privacy-friendly embed URL; anything else is played as a file. */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

const looksLikeHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

export function LessonView({
  lesson,
  onProgress,
}: {
  lesson: PlayerLesson;
  onProgress: (r: ProgressResult & { lessonId: string; quizScore?: number }) => void;
}) {
  const url = lesson.contentUrl ?? "";
  switch (lesson.type) {
    case "VIDEO": {
      const embed = embedUrl(url);
      return (
        <div className="ac-p-video">
          {embed ? (
            <iframe src={embed} title={lesson.title} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <video src={url} controls controlsList="nodownload" />
          )}
        </div>
      );
    }
    case "PDF":
      return (
        <div>
          <iframe src={url} title={lesson.title} className="ac-p-pdf" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="rh-link" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "0.6rem", fontSize: "var(--rh-t-small)" }}>
            Open PDF in a new tab <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      );
    case "TEXT": {
      const body = lesson.body ?? "";
      return looksLikeHtml(body) ? (
        <article className="prose prose-slate ac-p-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />
      ) : (
        <article className="ac-p-text" style={{ whiteSpace: "pre-line" }}>{body}</article>
      );
    }
    case "LINK":
      return (
        <div className="ac-p-link">
          {lesson.body && <p>{lesson.body}</p>}
          <a href={url} target="_blank" rel="noopener noreferrer" className="rh-btn rh-btn--primary">
            Open resource <ExternalLink size={16} aria-hidden="true" style={{ marginLeft: "0.4rem" }} />
          </a>
        </div>
      );
    case "QUIZ":
      return <Quiz lesson={lesson} onProgress={onProgress} />;
  }
}

function Quiz({ lesson, onProgress }: { lesson: PlayerLesson; onProgress: Parameters<typeof LessonView>[0]["onProgress"] }) {
  const questions = lesson.quiz ?? [];
  const [answers, setAnswers] = useState<number[]>(() => questions.map(() => -1));
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: boolean[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await academy.me.quiz(lesson.id, answers);
      setResult(r);
      if (r.passed) onProgress({ ...r, lessonId: lesson.id, quizScore: r.score });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ac-q">
      {lesson.completed && !result && (
        <p className="ac-d-note" data-tone="good">You passed this quiz{lesson.quizScore != null ? ` with ${lesson.quizScore}%` : ""}. You can retake it any time.</p>
      )}
      {questions.map((q, i) => (
        <fieldset key={i}>
          <legend>{i + 1}. {q.question}</legend>
          <div className="ac-q-opts">
            {q.options.map((opt, j) => (
              <label key={j} className="ac-q-opt" data-on={answers[i] === j}>
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === j}
                  onChange={() => { setResult(null); setAnswers((a) => a.map((x, k) => (k === i ? j : x))); }}
                />
                {opt}
              </label>
            ))}
          </div>
          {result && (
            <p className="ac-q-res" data-ok={result.correct[i]}>{result.correct[i] ? "Correct" : "Not quite"}</p>
          )}
        </fieldset>
      ))}
      {result && (
        <p className="ac-d-note" data-tone={result.passed ? "good" : "warn"} role="status">
          You scored {result.score}%. {result.passed ? "You passed." : "You need 60% to pass. Have another go."}
        </p>
      )}
      {error && <p className="ac-d-note" data-tone="error" role="alert">{error}</p>}
      <button type="button" onClick={submit} disabled={busy || answers.some((a) => a < 0)} aria-busy={busy} className="rh-btn rh-btn--primary" style={{ justifySelf: "start" }}>
        {busy ? "Checking…" : "Submit answers"}
      </button>
    </div>
  );
}
