"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HOURS, istNow, officeStatus } from "./contact-hours";
import "./droid.css";

const DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=17.447081,78.460012";
// The bars run from 8 am to 8 pm.
const START = 8 * 60;
const SPAN = 12 * 60;

function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}
const nowKey = () => {
  const { day, mins } = istNow();
  return day * 1440 + mins;
};
const clock = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export default function ContactVisit() {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const key = useSyncExternalStore(subscribeMinute, nowKey, () => null);
  const status = useSyncExternalStore(subscribeMinute, () => officeStatus().text, () => null);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const today = key === null ? null : Math.floor(key / 1440);
  const mins = key === null ? null : key % 1440;
  const inRange = mins !== null && mins >= START && mins <= START + SPAN;
  const open = status?.startsWith("Open") ?? false;

  return (
    <section ref={ref} id="visit" className="rh-sec rh-dark ct-visit" data-in={seen || undefined} aria-labelledby="ct-visit-h">
      <div className="rh-wrap ct-visit-grid">
        <div className="ct-visit-copy">
          <h2 id="ct-visit-h">Visit us in Begumpet.</h2>
          <p className="rh-lede">Come and meet the team in Hyderabad. Call ahead and we&apos;ll have the kits out for your child to try.</p>

          <div className="ct-hrs" style={{ "--p": inRange ? (mins! - START) / SPAN : 0 } as React.CSSProperties}>
            <table className="ct-hrs-table">
              <caption>Opening hours, India time</caption>
              <tbody>
                {HOURS.map((h, n) => {
                  const isToday = today !== null && h.days.includes(today);
                  const bar = h.open !== undefined && h.close !== undefined
                    ? { left: `${((h.open - START) / SPAN) * 100}%`, width: `${((h.close - h.open) / SPAN) * 100}%` }
                    : null;
                  return (
                    <tr key={h.label} data-today={isToday || undefined} style={{ "--i": n } as React.CSSProperties}>
                      <th scope="row">
                        <span className="ct-day-long">{h.label}</span>
                        <span className="ct-day-short">{h.short}</span>
                        {isToday && <span className="ct-today">Today</span>}
                      </th>
                      <td className="ct-hrs-track" aria-hidden="true">
                        <span>{bar ? <i style={bar} /> : <b className="ct-hrs-closed" />}</span>
                      </td>
                      <td className="ct-hrs-time">{h.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ct-hrs-axis" aria-hidden="true">
              <span>8 am</span><span>12 pm</span><span>4 pm</span><span>8 pm</span>
            </div>
            {inRange && (
              <div className="ct-now" data-open={open || undefined} aria-hidden="true">
                <span>Now, {clock(mins!)}</span>
              </div>
            )}
          </div>

          {status && (
            <p className="ct-visit-status" data-open={open || undefined}>
              <span className="ct-status-dot" aria-hidden="true" />
              {status}
            </p>
          )}

          <div className="rh-actions">
            <a href={DIRECTIONS} target="_blank" rel="noopener noreferrer" className="rh-btn rh-btn--primary">Get directions</a>
            <a href="tel:+918500345655" className="rh-btn rh-btn--ghost">Call before you come</a>
          </div>
        </div>

        <div className="ct-map">
          <iframe
            src="https://maps.google.com/maps?q=17.447081,78.460012&hl=en&z=15&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Map of the RoboCoders office in Begumpet, Hyderabad"
            tabIndex={-1}
          />
          <div className="ct-map-pin" aria-hidden="true">
            <i className="ct-ping" />
            <i className="ct-ping" />
            <div className="ct-sorter ct-map-droid">
              <div className="droid__head-container">
                <div className="droid__antenna" />
                <div className="droid__antenna" />
                <div className="droid__head" />
              </div>
              <div className="droid__body" />
            </div>
          </div>
          <a className="ct-map-link" href={DIRECTIONS} target="_blank" rel="noopener noreferrer" aria-label="Open directions to RoboCoders in Google Maps" />
          <div className="ct-map-card" aria-hidden="true">
            <b>RoboCoders</b>
            <span>Begumpet, Hyderabad, Telangana, India</span>
            <small>Open in Google Maps</small>
          </div>
        </div>
      </div>
    </section>
  );
}
