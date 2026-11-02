import Footer from "../../../components/Footer";
import { RoboBreadcrumbs } from "../../../components/seo/JsonLd";
import ContactHero from "../../../components/public/ContactHero";
import ContactRoutes from "../../../components/public/ContactRoutes";
import ContactForm from "../../../components/public/ContactForm";
import ContactVisit from "../../../components/public/ContactVisit";
import "../../../components/public/robo-home.css";
import "../../../components/public/contact.css";
import { display, body } from "../robo-fonts";

export default function ContactPage() {
  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Contact", path: "/contact" },
        ]}
      />
      <main>
        <ContactHero />

        <ContactRoutes />

        <section id="message" className="rh-sec rh-wash ct-write" aria-labelledby="ct-write-h" data-leadbot-quiet>
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="ct-write-h">Send us a message.</h2>
              <p className="rh-lede">Pick a topic and we&apos;ll route it to the right person. You&apos;ll see your message the way we&apos;ll get it.</p>
            </div>
            <ContactForm />
          </div>
        </section>

        <ContactVisit />
      </main>
      <Footer />
    </div>
  );
}
