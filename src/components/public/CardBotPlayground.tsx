"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  CornerUpLeft,
  CornerUpRight,
  Play,
  RotateCcw,
  Star,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Move = "forward" | "left" | "right" | "uturn";

const CARDS: Record<Move, { label: string; icon: LucideIcon; turn: number }> = {
  forward: { label: "Forward", icon: ArrowUp, turn: 0 },
  left: { label: "Left", icon: CornerUpLeft, turn: -90 },
  right: { label: "Right", icon: CornerUpRight, turn: 90 },
  uturn: { label: "U-Turn", icon: Undo2, turn: 180 },
};

const SIZE = 5;
const MAX_CARDS = 12;
const START = { x: 0, y: 4, rot: 0 };
const GOAL = { x: 4, y: 0 };
const ROCKS = [
  { x: 2, y: 1 },
  { x: 2, y: 3 },
  { x: 4, y: 3 },
];
const STEP: Record<number, { dx: number; dy: number }> = {
  0: { dx: 0, dy: -1 },
  1: { dx: 1, dy: 0 },
  2: { dx: 0, dy: 1 },
  3: { dx: -1, dy: 0 },
};

type Robot = typeof START;
type Status = "idle" | "running" | "win" | "crash" | "done";

function apply(robot: Robot, move: Move): Robot {
  if (move !== "forward") return { ...robot, rot: robot.rot + CARDS[move].turn };
  const { dx, dy } = STEP[(((robot.rot / 90) % 4) + 4) % 4];
  return { ...robot, x: robot.x + dx, y: robot.y + dy };
}

const isBlocked = ({ x, y }: Robot) =>
  x < 0 || y < 0 || x >= SIZE || y >= SIZE || ROCKS.some((r) => r.x === x && r.y === y);

const MESSAGES: Record<Status, string> = {
  idle: "Tap cards to build a path, then press Run.",
  running: "The robot is reading your cards…",
  win: "You reached the star! 🎉",
  crash: "Oops! The robot bumped into something. Try again.",
  done: "Out of cards — the robot didn’t reach the star yet.",
};

export default function CardBotPlayground() {
  const [program, setProgram] = useState<Move[]>([]);
  const [robot, setRobot] = useState<Robot>(START);
  const [step, setStep] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const running = step !== null;

  useEffect(() => {
    if (step === null) return;
    const t = setTimeout(() => {
      const next = apply(robot, program[step]);
      if (isBlocked(next)) {
        setStatus("crash");
        setStep(null);
        return;
      }
      setRobot(next);
      if (next.x === GOAL.x && next.y === GOAL.y) {
        setStatus("win");
        setStep(null);
      } else if (step + 1 >= program.length) {
        setStatus("done");
        setStep(null);
      } else {
        setStep(step + 1);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [step, robot, program]);

  const run = () => {
    setRobot(START);
    setStatus("running");
    setStep(0);
  };

  const reset = () => {
    setStep(null);
    setRobot(START);
    setStatus("idle");
  };

  const add = (move: Move) => {
    if (running || program.length >= MAX_CARDS) return;
    setProgram((p) => [...p, move]);
    if (status !== "idle") reset();
  };

  const removeAt = (i: number) => {
    if (running) return;
    setProgram((p) => p.filter((_, idx) => idx !== i));
    if (status !== "idle") reset();
  };

  const pct = (n: number) => `${(n * 100) / SIZE}%`;

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 md:gap-10">
      {/* Board */}
      <div>
        <div className="relative aspect-square w-full max-w-[420px] mx-auto rounded-2xl bg-blue-50 border-4 border-blue-100 overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-5 grid-rows-5">
            {Array.from({ length: SIZE * SIZE }, (_, i) => (
              <div key={i} className="border border-blue-100" />
            ))}
          </div>
          {ROCKS.map((r) => (
            <div
              key={`${r.x}-${r.y}`}
              className="absolute p-[3%]"
              style={{ left: pct(r.x), top: pct(r.y), width: pct(1), height: pct(1) }}
            >
              <div className="w-full h-full rounded-xl bg-gray-300 border-b-4 border-gray-400" aria-label="Rock" />
            </div>
          ))}
          <div
            className="absolute flex items-center justify-center"
            style={{ left: pct(GOAL.x), top: pct(GOAL.y), width: pct(1), height: pct(1) }}
          >
            <Star className="w-1/2 h-1/2 text-amber-400 fill-amber-300" aria-label="Goal" />
          </div>
          <motion.div
            className="absolute flex items-center justify-center p-[2%]"
            style={{ width: pct(1), height: pct(1) }}
            animate={{ left: pct(robot.x), top: pct(robot.y) }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
          >
            <motion.div
              className="w-full h-full rounded-2xl bg-blue-600 shadow-lg flex flex-col items-center justify-center"
              animate={{ rotate: robot.rot, scale: status === "crash" ? [1, 0.85, 1] : 1 }}
              transition={{
                rotate: { type: "spring", stiffness: 200, damping: 18 },
                scale: { duration: 0.35 },
              }}
            >
              <ArrowUp className="w-1/3 h-1/3 text-amber-300 -mb-1" strokeWidth={3} />
              <Bot className="w-1/2 h-1/2 text-white" />
            </motion.div>
          </motion.div>
        </div>
        <p
          className={`mt-4 text-center font-semibold min-h-[1.5rem] ${
            status === "win" ? "text-green-600" : status === "crash" ? "text-red-500" : "text-gray-600"
          }`}
          aria-live="polite"
        >
          {MESSAGES[status]}
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-col">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Pick your cards</h3>
        <p className="text-gray-600 text-sm md:text-base mb-4">
          Guide the robot to the star without hitting the rocks.
        </p>
        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
          {(Object.keys(CARDS) as Move[]).map((move) => {
            const { label, icon: Icon } = CARDS[move];
            return (
              <motion.button
                key={move}
                type="button"
                onClick={() => add(move)}
                disabled={running || program.length >= MAX_CARDS}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.94 }}
                className="h-24 md:h-28 rounded-2xl bg-blue-600 text-white shadow-md flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon className="h-7 w-7 md:h-9 md:w-9" strokeWidth={2.5} />
                <span className="text-xs md:text-sm font-bold">{label}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Your path ({program.length}/{MAX_CARDS})
          </span>
          {program.length > 0 && !running && (
            <span className="text-xs text-gray-500">Tap a card to remove it</span>
          )}
        </div>
        <div className="min-h-[92px] rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-2 flex flex-wrap gap-2 content-start mb-6">
          {program.length === 0 && (
            <span className="m-auto text-sm text-gray-400">Your cards will appear here</span>
          )}
          {program.map((move, i) => {
            const { label, icon: Icon } = CARDS[move];
            return (
              <motion.button
                key={`${i}-${move}`}
                type="button"
                layout
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: step === i ? 1.12 : 1, opacity: 1 }}
                onClick={() => removeAt(i)}
                disabled={running}
                aria-label={`Remove card ${i + 1}: ${label}`}
                className={`group relative w-14 h-[72px] rounded-xl flex flex-col items-center justify-center gap-0.5 border-2 transition-colors ${
                  step === i
                    ? "bg-amber-300 border-amber-400 text-blue-900"
                    : "bg-white border-blue-200 text-blue-600"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.5} />
                <span className="text-[10px] font-bold">{label}</span>
                {!running && (
                  <X className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gray-700 text-white p-0.5 opacity-0 group-hover:opacity-100" />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="mt-auto flex flex-wrap gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running || program.length === 0}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-12 px-7 rounded-full font-bold transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Play className="h-5 w-5" /> Run
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 h-12 px-6 rounded-full font-bold"
          >
            <RotateCcw className="h-5 w-5" /> Reset
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setProgram([]);
            }}
            disabled={running || program.length === 0}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 h-12 px-4 font-semibold disabled:opacity-40"
          >
            <Trash2 className="h-5 w-5" /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
