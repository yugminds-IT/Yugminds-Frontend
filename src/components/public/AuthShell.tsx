import { display, body } from "../../app/robocoders/robo-fonts";
import HomeNav from "./HomeNav";
import "./robo-home.css";
import "./login.css";

/* The frame shared by every LMS auth page: the RoboCoders nav, a navy grid panel on the left that explains or previews
   what is going on, and a plain form column on the right. On small screens the form comes first. */
export default function AuthShell({
  sideTitle,
  sideText,
  side,
  wide = false,
  children,
}: {
  sideTitle: string;
  sideText: string;
  side: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className={`rh-nav ${display.variable} ${body.variable}`}>
        <HomeNav />
      </div>
      <div className={`rh ${display.variable} ${body.variable}`}>
        <main className="lg">
          <section className="rh-dark lg-side" aria-labelledby="lg-side-h">
            <div className="lg-side-head">
              <h2 id="lg-side-h">{sideTitle}</h2>
              <p className="rh-lede">{sideText}</p>
            </div>
            {side}
          </section>
          <section className="lg-main">
            <div className={wide ? "lg-card lg-card--wide" : "lg-card"}>{children}</div>
          </section>
        </main>
      </div>
    </>
  );
}
