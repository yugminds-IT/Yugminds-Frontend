"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { confirmDialog } from "@/components/ui/confirm-dialog";

let activePrompt: (() => Promise<boolean>) | null = null;

/**
 * For in-app navigation that isn't a link (e.g. course-player item buttons):
 * resolves true when it's fine to move on — no attempt in progress, or the
 * student chose to exit and discard it.
 */
export function confirmLeaveAssignment(): Promise<boolean> {
  return activePrompt ? activePrompt() : Promise.resolve(true);
}

/**
 * While `active`, stops the student leaving an in-progress assignment via
 * links (sidebar tabs), the browser back button or `confirmLeaveAssignment`
 * callers without confirming. `onLeave` runs when they choose to exit and
 * must discard the attempt. Refresh/close is left to `beforeunload`.
 */
export function useAssignmentLeaveGuard(active: boolean, onLeave: () => void) {
  const router = useRouter();
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;
  const leavingViaBackRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    leavingViaBackRef.current = false;

    let prompting = false;
    const prompt = async () => {
      if (prompting) return false;
      prompting = true;
      try {
        const ok = await confirmDialog({
          title: "Leave this assignment?",
          description:
            "Your attempted answers will be lost if you leave now. Complete the questions and submit the assignment, or exit without saving.",
          cancelText: "Continue assignment",
          confirmText: "Exit anyway",
          variant: "danger",
        });
        if (ok) onLeaveRef.current();
        return ok;
      } finally {
        prompting = false;
      }
    };
    activePrompt = prompt;

    // Capture phase on document runs before Next's <Link> handler on the React root.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void prompt().then((ok) => {
        if (ok) router.push(url.pathname + url.search + url.hash);
      });
    };

    // Extra same-URL history entry so the browser back button lands here first.
    // Keeping Next's state (__NA + tree) stops the App Router reloading the page.
    const trap = () => window.history.pushState({ ...window.history.state, __assignmentGuard: true }, "", window.location.href);
    if (!window.history.state?.__assignmentGuard) trap();
    const onPopState = () => {
      if (leavingViaBackRef.current) return;
      trap();
      void prompt().then((ok) => {
        if (ok) {
          leavingViaBackRef.current = true;
          window.history.go(-2);
        }
      });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      if (activePrompt === prompt) activePrompt = null;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [active, router]);

  /** For the page's own Back/Exit button (stays on this URL). */
  return useCallback((then: () => void) => {
    void confirmLeaveAssignment().then((ok) => {
      if (!ok) return;
      then();
      if (window.history.state?.__assignmentGuard) {
        leavingViaBackRef.current = true;
        window.history.back();
      }
    });
  }, []);
}
