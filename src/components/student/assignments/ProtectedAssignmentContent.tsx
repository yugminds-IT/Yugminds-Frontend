"use client";

import { useEffect, useRef, type ReactNode, type SyntheticEvent } from "react";
import { toast } from "@/components/ui/toast";
import { WORD_CHIP_MIME } from "@/components/student/assignments/questions/FillBlankQuestion";

/** Inputs/textareas stay fully usable so students can type and edit their own answers. */
const NON_TEXT_INPUTS = new Set(["radio", "checkbox", "button", "submit", "reset", "file", "image", "range", "color", "hidden"]);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target.isContentEditable || target.tagName === "TEXTAREA";
}

function isWordChipDrag(e: SyntheticEvent): boolean {
  const dt = (e.nativeEvent as DragEvent).dataTransfer;
  return !!dt && Array.from(dt.types).includes(WORD_CHIP_MIME);
}

const COPY_WARNING = "Copying assignment questions is disabled.";
const PASTE_WARNING = "Pasting into answers is disabled. Please type your answer.";

/**
 * Deters copying assignment questions out of the student portal (e.g. to paste
 * into an AI tool) and pasting AI answers back in: disables text selection,
 * copy/cut, right-click, drag, paste/drop and printing inside the wrapped area. Screenshots and a second device can't be
 * blocked by a web page — this raises the effort, it isn't DRM.
 */
export default function ProtectedAssignmentContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const lastWarnRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const warn = (message = COPY_WARNING) => {
    const now = Date.now();
    if (now - lastWarnRef.current < 3000) return;
    lastWarnRef.current = now;
    toast.warning(message);
  };

  const block = (e: SyntheticEvent) => {
    if (isEditable(e.target)) return;
    e.preventDefault();
    warn();
  };

  const blockPaste = (e: SyntheticEvent) => {
    if (isWordChipDrag(e)) return;
    e.preventDefault();
    warn(PASTE_WARNING);
  };

  const blockDragStart = (e: SyntheticEvent) => {
    if (e.target instanceof Element && e.target.closest("[data-word-chip]")) return;
    block(e);
  };

  // Catches paste/drop paths that skip the paste event (e.g. mobile keyboards' clipboard strip).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType.startsWith("insertFromPaste") || e.inputType === "insertFromDrop" || e.inputType === "insertFromYank") {
        e.preventDefault();
        warn(PASTE_WARNING);
      }
    };
    root.addEventListener("beforeinput", onBeforeInput);
    return () => root.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "p" || key === "s" || (key === "a" && !isEditable(e.target))) {
        e.preventDefault();
        warn();
      }
    };
    // Document-level so a selection starting outside the wrapper and extending into it is still caught.
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return;
      const root = rootRef.current;
      const sel = document.getSelection();
      const touchesQuestions =
        !!root &&
        ((e.target instanceof Node && root.contains(e.target)) ||
          (!!sel && !sel.isCollapsed && sel.containsNode(root, true)));
      if (!touchesQuestions) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", "");
      warn();
    };
    const onBeforePrint = () => warn();
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    window.addEventListener("beforeprint", onBeforePrint);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, []);

  return (
    <>
      <div
        ref={rootRef}
        className={`protected-assignment select-none print:hidden ${className}`}
        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
        onCopy={block}
        onCut={block}
        onContextMenu={block}
        onDragStart={blockDragStart}
        onPaste={blockPaste}
        onDrop={blockPaste}
      >
        {children}
      </div>
      <p className="hidden print:block p-8 text-center text-sm">
        Printing assignments is disabled.
      </p>
      <style>{`
        .protected-assignment input,
        .protected-assignment textarea,
        .protected-assignment [contenteditable="true"] {
          user-select: text;
          -webkit-user-select: text;
        }
      `}</style>
    </>
  );
}
