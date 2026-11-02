import Link from "next/link";
import { BRAND_ORIGINS, brandHref } from "@/lib/brand-host";
import { Code, Hand, Lightbulb, MonitorSmartphone, MousePointerClick, Radar, Route, ToggleRight, Zap } from "lucide-react";
import Footer from "../../../components/Footer";
import PlayKit from "../../../components/public/PlayKit";
import HomeCount from "../../../components/public/HomeCount";
import JuniorKit from "../../../components/public/JuniorKit";
import KitLab from "../../../components/public/KitLab";
import ProductsFaq from "../../../components/public/ProductsFaq";
import ProductsFinder from "../../../components/public/ProductsFinder";
import ProductsSoftware from "../../../components/public/ProductsSoftware";
import { JsonLd, RoboBreadcrumbs, faqPageJsonLd } from "../../../components/seo/JsonLd";
import "../../../components/public/robo-home.css";
import "../../../components/public/about.css";
import "../../../components/public/programs.css";
import "../../../components/public/products.css";
import { display, body } from "../robo-fonts";

export const revalidate = 3600;

const products = [
  {
    id: "studio",
    title: "RoboCoders Studio",
    description:
      "Offline desktop software for block coding, Python, AI experiments and robot control — all in one app.",
    badges: ["Ages 8+", "Works offline"],
  },
  {
    id: "robotics-kit",
    title: "Robotics Kit — ESP32 Edition",
    description:
      "A custom ESP32 board, sensors, motors and chassis with 40+ guided robotics, IoT and automation projects.",
    badges: ["40+ projects", "Block & C coding"],
  },
  {
    id: "junior-kit",
    title: "Junior Robotics Kit",
    description:
      "No-code robotics for grades 1 to 3. Children press a button and make lights and sounds happen.",
    badges: ["Grades 1 to 3", "No code needed"],
  },
  {
    id: "play-kit",
    title: "RoboCoders Play Kit",
    description:
      "Screen-free coding for young kids. Lay out direction cards and the robot follows them, step by step.",
    badges: ["Screen-free", "Learn by playing"],
  },
];

const kitHighlights = [
  { Icon: Code, text: "Block-based coding and C programming" },
  { Icon: MonitorSmartphone, text: "Works with laptops, desktops and Chromebooks" },
  { Icon: Radar, text: "IR, ultrasonic, LDR and DHT11 sensors included" },
  { Icon: Route, text: "Obstacle, line, light, object-following and maze-solver robots" },
  { Icon: Lightbulb, text: "OLED display, LEDs and buzzer outputs" },
  { Icon: Zap, text: "Labelled pins for easy, safe connections" },
];

const faqs = [
  {
    question: "What products does RoboCoders offer?",
    answer:
      "RoboCoders, the EdTech initiative of YugMinds, offers four products: RoboCoders Studio (offline desktop software for coding, AI and robotics), the YugMinds Robotics Kit — ESP32 Edition (a hands-on robotics and IoT kit with 40+ guided projects), the Junior Robotics Kit (a no-code board kit for grades 1 to 3) and the RoboCoders Play Kit (a screen-free, card-controlled coding robot for young kids).",
    href: "#studio",
    cta: "See the products",
  },
  {
    question: "What is RoboCoders Studio?",
    answer:
      "RoboCoders Studio is a desktop app that brings block coding, Python, AI experiments and robot control into one place. It is designed for students aged 8 and above and works completely offline, so it suits classrooms with limited internet as well as learning at home.",
    href: "#studio",
    cta: "See Studio",
  },
  {
    question: "Does RoboCoders Studio need an internet connection?",
    answer:
      "No. RoboCoders Studio runs entirely on the device, so students can learn coding, AI and robotics with zero internet required.",
    href: "#studio",
    cta: "See Studio",
  },
  {
    question: "What is included in the YugMinds ESP32 Robotics Kit?",
    answer:
      "The kit includes a custom ESP32 board, sensors, motors and a chassis, with guided projects that take students from a first light to a robot that moves. Contact the RoboCoders team for the full kit details.",
    href: "#robotics-kit",
    cta: "See the robotics kit",
  },
  {
    question: "How many projects can students build with the ESP32 Robotics Kit?",
    answer:
      "Students can build 40+ guided projects, from simple lights and displays to line-following, obstacle-avoiding and Bluetooth-controlled robots.",
    href: "#robotics-kit",
    cta: "See the projects",
  },
  {
    question: "Which coding languages and devices does the robotics kit support?",
    answer:
      "The kit supports block-based coding and C programming, and works with laptops, desktops and Chromebooks. The ESP32 board also has built-in Wi-Fi and Bluetooth for wireless projects.",
    href: "#robotics-kit",
    cta: "See the robotics kit",
  },
  {
    question: "What is the Junior Robotics Kit?",
    answer:
      "The Junior Robotics Kit is a no-code robotics kit for grades 1 to 3. Children press a button and make lights and sounds happen, which teaches how inputs and outputs work. It needs no screen and no coding.",
    href: "#junior-kit",
    cta: "Try the demo",
  },
  {
    question: "How does the RoboCoders Play Kit work?",
    answer:
      "Kids control the robot with direction cards such as Forward, Left, Right and U-Turn. They place a card on the robot and it carries out that command — a Right card turns it right, a U-Turn card turns it around. This teaches sequencing, logic and problem-solving without any screen.",
    href: "#play-kit",
    cta: "Try the Play Kit",
  },
  {
    question: "Can schools order RoboCoders products in bulk?",
    answer:
      "Yes. Schools can contact the RoboCoders team for bulk orders, product demos and classroom packages for RoboCoders Studio, the ESP32 Robotics Kit, the Junior Robotics Kit and the Play Kit.",
    href: brandHref("/robocoders/contact"),
    cta: "Request a demo",
  },
];

const productListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "RoboCoders Products",
  itemListElement: products.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: p.title,
    description: p.description,
    url: `${BRAND_ORIGINS.robocoders}/products#${p.id}`,
  })),
};

export default function ProductsPage() {
  const contactHref = brandHref("/robocoders/contact");

  return (
    <div className={`rh ${display.variable} ${body.variable}`}>
      <JsonLd data={productListJsonLd} />
      <JsonLd data={faqPageJsonLd(faqs)} />
      <RoboBreadcrumbs
        crumbs={[
          { name: "RoboCoders", path: "/" },
          { name: "Products", path: "/products" },
        ]}
      />
      <main className="ab-main">
        <section className="ab-hero pg-hero" aria-labelledby="pd-h1">
          <div className="rh-wrap ab-hero-grid">
            <div className="ab-hero-copy">
              <h1 id="pd-h1">Software and kits to build with.</h1>
              <p className="rh-lede">Five products from YugMinds that make coding, AI and robotics hands-on at every age.</p>
              <div className="rh-actions">
                <Link href="#studio" className="rh-btn rh-btn--primary">See the products</Link>
                <Link href={contactHref} className="rh-btn rh-btn--ghost">Request a demo</Link>
              </div>
              <dl className="rh-facts">
                <div>
                  <dt><HomeCount to={5} /></dt>
                  <dd>products, from app to kit</dd>
                </div>
                <div>
                  <dt><HomeCount to={40} suffix="+" /></dt>
                  <dd>guided robotics projects</dd>
                </div>
                <div>
                  <dt>2</dt>
                  <dd>ways to run Studio: offline or online</dd>
                </div>
              </dl>
            </div>
            <ProductsFinder />
          </div>
        </section>

        <section id="studio" className="rh-sec pd-anchor" aria-labelledby="pd-soft">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pd-soft">Software to code and test in.</h2>
              <p className="rh-lede">Start on screen. Write the program, then check the circuit before touching a part.</p>
            </div>
            <ProductsSoftware />
          </div>
        </section>

        <section id="robotics-kit" className="rh-sec rh-wash pd-anchor" aria-labelledby="pd-kit">
          <div className="rh-wrap">
            <div className="pg-kit">
              <div className="pg-kit-video">
                <video src="/instagram-reel.mp4" autoPlay loop muted playsInline aria-label="The YugMinds ESP32 robotics kit being built and driven" />
              </div>
              <div className="pg-kit-copy">
                <h2 id="pd-kit">Build, code and control real robots.</h2>
                <p className="rh-lede">A custom ESP32 board with Wi-Fi, Bluetooth, motor control and sensor ports takes students from their first LED to a maze-solving robot.</p>
                <ul className="pg-kit-list">
                  {kitHighlights.map(({ Icon, text }) => (
                    <li key={text}><span className="rh-chip-ico"><Icon size={14} aria-hidden="true" /></span>{text}</li>
                  ))}
                </ul>
                <div className="rh-actions">
                  <Link href={contactHref} className="rh-btn rh-btn--primary">Order the robotics kit</Link>
                  <Link href={brandHref("/robocoders/for-schools")} className="rh-btn rh-btn--ghost">For schools</Link>
                </div>
              </div>
            </div>

            <dl className="pd-stats">
              <div><dt><HomeCount to={40} suffix="+" /></dt><dd>guided projects</dd></div>
              <div><dt><HomeCount to={15} suffix="+" /></dt><dd>components</dd></div>
              <div><dt><HomeCount to={5} /></dt><dd>robot types</dd></div>
              <div><dt>Wi-Fi + BT</dt><dd>wireless control</dd></div>
            </dl>

            <div className="pd-lab-head">
              <h3>Pick a part, see what it builds.</h3>
              <p className="rh-lede">Each project below runs live: the readings and motor levels come from the simulation.</p>
            </div>
            <KitLab />
          </div>
        </section>

        <section id="junior-kit" className="rh-sec pd-anchor" aria-labelledby="pd-junior">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pd-junior">Plug in. Press. See it work.</h2>
              <p className="rh-lede">The Junior Robotics Kit is for grades 1 to 3. Children press a button and make lights and sounds happen, with no code.</p>
            </div>
            <JuniorKit />
            <ul className="pd-junior-points">
              <li><span className="rh-chip-ico"><Hand size={16} aria-hidden="true" /></span>Hands-on from the first minute</li>
              <li><span className="rh-chip-ico"><MousePointerClick size={16} aria-hidden="true" /></span>Learn cause and effect by pressing and watching</li>
              <li><span className="rh-chip-ico"><ToggleRight size={16} aria-hidden="true" /></span>Inputs and outputs, with no code and no screen</li>
            </ul>
            <div className="rh-actions">
              <Link href={contactHref} className="rh-btn rh-btn--primary">Request a demo</Link>
              <Link href={brandHref("/robocoders/for-schools")} className="rh-btn rh-btn--ghost">For schools</Link>
            </div>
          </div>
        </section>

        <section id="play-kit" className="rh-sec rh-dark pd-anchor" aria-labelledby="pd-play">
          <div className="rh-wrap">
            <div className="pd-play-head">
              <h2 id="pd-play">Code with cards. No screen needed.</h2>
              <p className="rh-lede">Young kids control the robot by placing direction cards on it. Each card is a command, so they learn sequencing, logic and problem-solving by playing.</p>
            </div>
            <PlayKit />
          </div>
        </section>

        <section className="rh-sec" aria-labelledby="pd-faq">
          <div className="rh-wrap">
            <div className="rh-head">
              <h2 id="pd-faq">Questions, answered.</h2>
              <p className="rh-lede">What families and schools ask most about our products.</p>
            </div>
            <ProductsFaq faqs={faqs} />
          </div>
        </section>

        <section className="rh-sec rh-dark" aria-labelledby="pd-close">
          <div className="rh-wrap pd-close">
            <h2 id="pd-close">Bring RoboCoders products to your school.</h2>
            <p className="rh-lede">Talk to our team about bulk orders, demos and classroom packages for any of our products.</p>
            <div className="rh-actions">
              <Link href={contactHref} className="rh-btn rh-btn--primary">Request a demo</Link>
              <Link href={brandHref("/robocoders/programs")} className="rh-btn rh-btn--ghost">Explore programs</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
