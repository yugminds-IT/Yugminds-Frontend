"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from "lucide-react";

type Status = "answered" | "unanswered" | "unvisited";

const DOT_STYLES: Record<Status, string> = {
  answered: "bg-green-600 text-white border-green-600",
  unanswered: "bg-red-500 text-white border-red-500",
  unvisited: "bg-gray-100 text-gray-500 border-gray-300",
};

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
      <div className={`${statusBarClassName} z-20 border-b border-gray-100 bg-white/95 backdrop-blur px-5 py-2.5`}>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {statuses.map((status, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-current={i === current ? "step" : undefined}
              title={`Question ${i + 1} — ${
                status === "answered" ? "answered" : status === "unanswered" ? "not answered" : "not visited"
              }`}
              className={`h-8 w-8 flex-shrink-0 rounded-full border text-xs font-semibold transition-all ${DOT_STYLES[status]} ${
                i === current ? "ring-2 ring-blue-500 ring-offset-2 scale-110" : "hover:scale-105"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" />Answered ({answered})</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Not answered ({unanswered})</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-gray-300 bg-gray-100" />Not visited ({unvisited})</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">
          Question {current + 1} of {count}
        </p>
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

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {submitting ? "Submitting…" : "Submit Assignment"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
            >
              Next Question
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
