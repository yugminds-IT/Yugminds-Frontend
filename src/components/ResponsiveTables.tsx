"use client";

import { useEffect } from "react";

/** Copies each column header onto its body cells as `data-label`, so the
 *  mobile CSS in globals.css can stack table rows into labelled cards.
 *  ManagementTable has its own mobile layout, and grids such as timetables
 *  opt out with `data-no-stack`. */
function labelTables(root: Element) {
  root.querySelectorAll("table").forEach((table) => {
    if (table.closest("[data-management-table], [data-no-stack]")) return;
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    if (!headRow) return;

    const labels: string[] = [];
    for (const th of Array.from(headRow.cells)) {
      const text = th.textContent?.trim() ?? "";
      for (let i = 0; i < th.colSpan; i++) labels.push(text);
    }
    table.setAttribute("data-stack", "");

    for (const body of Array.from(table.tBodies)) {
      for (const row of Array.from(body.rows)) {
        let col = 0;
        for (const cell of Array.from(row.cells)) {
          const label = cell.colSpan === 1 ? labels[col] : "";
          if (label) {
            if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
          } else if (cell.hasAttribute("data-label")) {
            cell.removeAttribute("data-label");
          }
          col += cell.colSpan;
        }
      }
    }
  });
}

export default function ResponsiveTables() {
  useEffect(() => {
    const root = document.querySelector("[data-dashboard-content]");
    if (!root) return;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => labelTables(root));
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
