"use client";

import { display, body } from "../../app/robocoders/robo-fonts";
import "./robo-home.css";
import "./droid.css";
import "./status.css";

type Variant = "error" | "critical" | "notfound" | "loading";
type Action = { label: string; href?: string; onClick?: () => void; kind?: "primary" | "ghost" };

function Droid({ className = "" }: { className?: string }) {
  return (
    <div className={`droid-mini es-droid ${className}`}>
      <div className="droid__head-container"><div className="droid__antenna" /><div className="droid__antenna" /><div className="droid__head" /></div>
      <div className="droid__body" />
    </div>
  );
}

/* One animated scene per kind of screen, CSS only: a hurt droid for errors, a lost droid at a dead end for a missing
   page, and a droid rolling along a bar while something loads. */
function Scene({ variant }: { variant: Variant }) {
  if (variant === "notfound") {
    return (
      <div className="es-scene es-scene--lost" aria-hidden="true">
        <div className="es-walk"><span className="es-q">?</span><Droid /></div>
        <div className="es-path" />
        <div className="es-sign"><b>404</b></div>
      </div>
    );
  }
  if (variant === "loading") {
    return (
      <div className="es-scene es-scene--load" aria-hidden="true">
        <div className="es-rail"><i /><div className="es-roll"><Droid /></div></div>
      </div>
    );
  }
  return (
    <div className="es-scene es-scene--error" aria-hidden="true">
      <span className="es-spark es-spark--1" /><span className="es-spark es-spark--2" /><span className="es-spark es-spark--3" />
      <div className="es-hurt"><span className="es-warn">!</span><Droid /></div>
      <div className="es-shadow" />
    </div>
  );
}

/* The one screen behind every error, missing page and loading state. It wears the RoboCoders look: a circuit-grid
   background, the droid, plain wording, and a clear way out. Technical details sit behind a disclosure so a person is
   not handed a stack message first. */
export default function StatusScreen({
  variant,
  title,
  text,
  detail,
  tips,
  actions = [],
  links = [],
}: {
  variant: Variant;
  title: string;
  text?: string;
  detail?: string;
  tips?: string[];
  actions?: Action[];
  links?: { label: string; href: string }[];
}) {
  const dark = variant === "critical";
  return (
    <div className={`rh es es--${variant} ${dark ? "rh-dark" : ""} ${display.variable} ${body.variable}`} role={variant === "loading" ? "status" : undefined} aria-live={variant === "loading" ? "polite" : undefined}>
      <div className="es-card">
        <Scene variant={variant} />
        <h1>{title}</h1>
        {text && <p className="es-text">{text}</p>}
        {variant === "loading" && <span className="es-dots" aria-hidden="true"><i /><i /><i /></span>}

        {tips && tips.length > 0 && (
          <ul className="es-tips">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        )}

        {actions.length > 0 && (
          <div className="rh-actions es-actions">
            {actions.map((a) =>
              a.href ? (
                <a key={a.label} href={a.href} className={`rh-btn ${a.kind === "ghost" ? "rh-btn--ghost" : "rh-btn--primary"}`}>{a.label}</a>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} className={`rh-btn ${a.kind === "ghost" ? "rh-btn--ghost" : "rh-btn--primary"}`}>{a.label}</button>
              ),
            )}
          </div>
        )}

        {links.length > 0 && (
          <nav className="es-links" aria-label="Pages you may want">
            {links.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
          </nav>
        )}

        {detail && (
          <details className="es-details">
            <summary>Technical details</summary>
            <code>{detail}</code>
          </details>
        )}
      </div>
    </div>
  );
}
