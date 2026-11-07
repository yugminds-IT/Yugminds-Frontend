"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle, Loader2 } from "lucide-react";

type Status = "answered" | "unanswered" | "unvisited";

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

interface QuestionStepperProps {
  count: number;
  isAnswered: (index: number) => boolean;
  renderQuestion: (index: number) => ReactNode;
  onSubmit: () => void;
  submitting: boolean;
  /** Shown above the submit button on the last question (e.g. file upload). */
  lastStepExtra?: ReactNode;
  /** Classes for the status bar, e.g. its sticky offset under a page header. */
  statusBarClassName?: string;
}

/**
 * One question at a time with slide transitions. Status dots: green =
 * answered, red = opened but not answered, grey = not opened yet.
 */
export default function QuestionStepper({
  count,
  isAnswered,
  renderQuestion,
  onSubmit,
  submitting,
  lastStepExtra,
  statusBarClassName = "sticky top-0",
}: QuestionStepperProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const topRef = useRef<HTMLDivElement>(null);

  const goTo = (index: number) => {
    if (index === current || index < 0 || index >= count) return;
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
    setVisited((prev) => new Set(prev).add(index));
  };

  useEffect(() => {
    const el = topRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current]);

  if (count === 0) return null;

  const statusOf = (i: number): Status =>
    isAnswered(i) ? "answered" : visited.has(i) ? "unanswered" : "unvisited";
  const statuses = Array.from({ length: count }, (_, i) => statusOf(i));
  const answered = statuses.filter((s) => s === "answered").length;
  const unanswered = statuses.filter((s) => s === "unanswered").length;
  const unvisited = count - answered - unanswered;
  const isLast = current === count - 1;

  return (
    <div ref={topRef} className="scroll-mt-16">
      <div className={`${statusBarClassName} qs-bar`}>
        <div className="qs-dots">
          {statuses.map((status, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === current ? "step" : undefined}
              data-s={status === "unanswered" ? "skipped" : status}
              title={`Question ${i + 1}: ${
                status === "answered" ? "answered" : status === "unanswered" ? "not answered yet" : "not opened yet"
              }`}
              className="qs-dot"
            >
              {status === "answered" ? <Check className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" /> : i + 1}
            </button>
          ))}
        </div>
        <div className="qs-prog">
          <span className="sd-meter" role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={count} aria-label="Questions answered">
            <i style={{ "--p": `${(answered / count) * 100}%` } as React.CSSProperties} />
          </span>
          <span><b>{answered}</b> of {count} answered{unanswered > 0 ? `, ${unanswered} skipped` : ""}{unvisited > 0 && unanswered === 0 ? "" : ""}</span>
        </div>
      </div>

      <div className="ls" style={{ paddingTop: "1.5rem" }}>
        <p className="qs-q">Question {current + 1} of {count}</p>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={current}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {renderQuestion(current)}
            </motion.div>
          </AnimatePresence>
        </div>

        {isLast && lastStepExtra}

        <div className="qs-nav">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Previous question"
            className="sd-btn sd-btn--line"
          >
            <ArrowLeft aria-hidden="true" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {isLast ? (
            <button type="button" onClick={onSubmit} disabled={submitting} className="sd-btn sd-btn--amber sd-btn--lg">
              {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              {submitting ? "Handing in" : "Hand it in"}
            </button>
          ) : (
            <button type="button" onClick={() => goTo(current + 1)} className="sd-btn sd-btn--amber sd-btn--lg">
              Next question
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
