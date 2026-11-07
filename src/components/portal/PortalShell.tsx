"use client";

import { useEffect } from "react";
import { portalBody, portalDisplay } from "./portal-fonts";

/**
 * The frame every dashboard sits in: the portal tokens and fonts, the sidebar beside the page, and a scrolling content
 * area. It also puts the portal skin on <body> so dialogs that render in a portal (confirm boxes) match the look.
 * `top` holds fixed things (banners, prompts) that sit outside the flow.
 */
export default function PortalShell({
  sidebar,
  top,
  children,
}: {
  sidebar?: React.ReactNode;
  top?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const classes = ["sd-skin", portalDisplay.variable, portalBody.variable];
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, []);

  return (
    <div className={`sd ${portalDisplay.variable} ${portalBody.variable} flex flex-col md:flex-row h-screen`} style={{ backgroundColor: "#eef3fc" }}>
      {top}
      {sidebar}
      <div className="flex-1 min-w-0 min-h-0 overflow-y-auto" data-dashboard-content style={{ backgroundColor: "#eef3fc" }}>
        {children}
      </div>
    </div>
  );
}
