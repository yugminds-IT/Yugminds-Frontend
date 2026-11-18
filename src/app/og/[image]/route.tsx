import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const dynamicParams = false;

// One card per brand + one per key page. Each brand draws in its own site's design system:
//   yugminds   = white, blue-only, Chakra Petch, circuit schematic   (the "one roof" landing)
//   robocoders = navy blueprint grid, Bricolage + Figtree, amber accent (the rh- system)
//   lms        = light portal paper with a dashboard fragment          (the sd-/portal system)
//   academy    = blue paper, Chakra Petch, live-class video tile       (the Academy)
type Theme = "yugminds" | "robocoders" | "lms" | "academy";
type Card = {
  theme: Theme;
  title: string;
  sub: string;
  chips: string[];
  domain: string;
  /** yugminds: index of the highlighted division node. robocoders: corner badge text. */
  mark?: number | string;
};

const DIVISIONS = ["Software", "Electronics", "Manufacturing", "RoboCoders"];

const CARDS: Record<string, Card> = {
  yugminds: { theme: "yugminds", title: "We build robots, software and electronics.", sub: "One Hyderabad team, from code to circuit board to finished machine.", chips: [], domain: "yugminds.org", mark: 0 },
  "yugminds-about": { theme: "yugminds", title: "A small team that builds and teaches.", sub: "Who we are, what we make, and why we run robotics labs in schools.", chips: [], domain: "yugminds.org/about", mark: 3 },
  "yugminds-work": { theme: "yugminds", title: "Things we have built.", sub: "Custom software, electronics and machines, shipped for real clients.", chips: [], domain: "yugminds.org/work", mark: 2 },
  "yugminds-divisions": { theme: "yugminds", title: "Four divisions. One roof.", sub: "Software, electronics, manufacturing and RoboCoders, working as one.", chips: [], domain: "yugminds.org/divisions", mark: 1 },
  "yugminds-contact": { theme: "yugminds", title: "Tell us what you need built.", sub: "Software, electronics or a school lab. We reply within a working day.", chips: [], domain: "yugminds.org/contact", mark: 0 },
  "yugminds-careers": { theme: "yugminds", title: "Join the team that builds.", sub: "Trainers, engineers and makers wanted across Hyderabad.", chips: [], domain: "yugminds.org/careers", mark: 3 },

  robocoders: { theme: "robocoders", title: "Coding, robotics & AI for students.", sub: "Hands-on STEM programs for ages 6 to 18, with kits, textbooks and certificates.", chips: ["Coding", "Robotics", "AI"], domain: "robocoders.yugminds.org", mark: "Ages 6–18" },
  "robocoders-about": { theme: "robocoders", title: "Learning you can hold in your hands.", sub: "RoboCoders is the STEM education initiative from YugMinds.", chips: ["Our story", "Our method"], domain: "robocoders.yugminds.org/about", mark: "About us" },
  "robocoders-programs": { theme: "robocoders", title: "Programs for every age, 6 to 18.", sub: "A clear path from first blocks to real code, robots and AI.", chips: ["Junior", "Level 1", "Level 2", "Level 3"], domain: "robocoders.yugminds.org/programs", mark: "Programs" },
  "robocoders-products": { theme: "robocoders", title: "Robotics kits and coding software.", sub: "Build it, wire it, program it. Kits and textbooks made for the classroom.", chips: ["Kits", "Textbooks", "Simulator"], domain: "robocoders.yugminds.org/products", mark: "Products" },
  "robocoders-community": { theme: "robocoders", title: "Student projects and challenges.", sub: "See what young makers built, and enter the next challenge.", chips: ["Projects", "Challenges"], domain: "robocoders.yugminds.org/community", mark: "Community" },
  "robocoders-for-schools": { theme: "robocoders", title: "A robotics lab for your school.", sub: "Curriculum, kits and trained teachers, set up and run for you.", chips: ["Lab setup", "Curriculum", "Trainers"], domain: "robocoders.yugminds.org/for-schools", mark: "For schools" },
  "robocoders-for-parents": { theme: "robocoders", title: "Courses for your child, from ₹999.", sub: "Pick a course, book a free trial, watch them build.", chips: ["Free trial", "Certificates"], domain: "robocoders.yugminds.org/for-parents", mark: "For parents" },
  "robocoders-online-classes": { theme: "robocoders", title: "Online classes. Free trial.", sub: "Live coding and robotics classes for kids, from home.", chips: ["Live", "Small batches", "Free trial"], domain: "robocoders.yugminds.org/online-classes", mark: "Online" },
  "robocoders-contact": { theme: "robocoders", title: "Talk to the RoboCoders team.", sub: "Questions about classes, kits or school labs? Ask us.", chips: ["Schools", "Parents"], domain: "robocoders.yugminds.org/contact", mark: "Contact" },

  lms: { theme: "lms", title: "Learn, practise and track progress.", sub: "One place for courses, assignments and certificates.", chips: ["Courses", "Assignments", "Attendance"], domain: "lms.yugminds.org" },
  academy: { theme: "academy", title: "Online courses and live 1:1 classes.", sub: "Self-paced coding, robotics and AI, plus live tutors.", chips: ["Self-paced", "Live 1:1", "Certificates"], domain: "academy.yugminds.org" },
};

export function generateStaticParams() {
  return Object.keys(CARDS).map((k) => ({ image: `${k}.png` }));
}

const INK = "#0b1b3a";
const BLUE = "#2563eb";
const NAVY = "#0a1f4d";
const AMBER = "#fbbf24";
const flex = (extra: Record<string, unknown> = {}) => ({ display: "flex" as const, ...extra });

function Chip({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <div style={flex({ padding: "10px 20px", borderRadius: 9999, fontSize: 22, fontWeight: 700, fontFamily: "Figtree",
      background: dark ? "rgba(255,255,255,0.1)" : "#ffffff", color: dark ? "#ffffff" : NAVY,
      border: `2px solid ${dark ? "#2a4380" : "#d3dcef"}` })}>
      {children}
    </div>
  );
}

function YugMinds({ c, logo }: { c: Card; logo: string }) {
  const active = typeof c.mark === "number" ? c.mark : 0;
  return (
    <div style={flex({ width: "100%", height: "100%", background: "#ffffff", fontFamily: "Chakra Petch", position: "relative" })}>
      <div style={flex({ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: BLUE })} />
      <div style={flex({ flexDirection: "column", justifyContent: "space-between", width: 700, padding: "56px 20px 56px 76px" })}>
        <div style={flex({ alignItems: "center", gap: 16 })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={60} height={60} alt="" />
          <div style={flex({ fontSize: 34, fontWeight: 700, color: INK, letterSpacing: -0.5 })}>YugMinds</div>
        </div>
        <div style={flex({ flexDirection: "column" })}>
          <div style={flex({ fontSize: c.title.length > 34 ? 72 : 84, fontWeight: 700, lineHeight: 1.0, letterSpacing: -2.5, color: INK })}>{c.title}</div>
          <div style={flex({ marginTop: 26, fontSize: 28, lineHeight: 1.35, color: "#3d4b69", fontFamily: "Figtree", maxWidth: 560 })}>{c.sub}</div>
        </div>
        <div style={flex({ fontSize: 26, fontWeight: 500, color: BLUE })}>{c.domain}</div>
      </div>
      {/* Division schematic: one trunk, four branches, current page lit. */}
      <div style={flex({ flex: 1, position: "relative" })}>
        <div style={flex({ position: "absolute", left: 40, top: 110, width: 4, height: 410, background: BLUE })} />
        {DIVISIONS.map((d, i) => {
          const on = i === active;
          return (
            <div key={d} style={flex({ position: "absolute", left: 24, top: 100 + i * 136, alignItems: "center" })}>
              <div style={flex({ width: 36, height: 36, borderRadius: 9999, background: on ? BLUE : "#fff", border: `4px solid ${BLUE}` })} />
              <div style={flex({ width: 56, height: 4, background: BLUE })} />
              <div style={flex({ padding: "14px 28px", fontSize: 32, fontWeight: 700, letterSpacing: -0.5,
                background: on ? BLUE : "#eff6ff", color: on ? "#fff" : NAVY, border: `3px solid ${BLUE}` })}>{d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoboCoders({ c, logo }: { c: Card; logo: string }) {
  return (
    <div style={flex({ width: "100%", height: "100%", background: NAVY, fontFamily: "Figtree", position: "relative",
      backgroundImage: "linear-gradient(#12306f 2px, transparent 2px), linear-gradient(90deg, #12306f 2px, transparent 2px)", backgroundSize: "60px 60px" })}>
      <div style={flex({ flexDirection: "column", justifyContent: "space-between", width: 760, padding: "64px 24px 56px 72px" })}>
        <div style={flex({ flexDirection: "column" })}>
          <div style={flex({ fontSize: c.title.length > 32 ? 70 : 80, fontFamily: "Bricolage Grotesque", fontWeight: 800, lineHeight: 1.0, letterSpacing: -2.5, color: "#ffffff" })}>{c.title}</div>
          <div style={flex({ marginTop: 26, fontSize: 28, lineHeight: 1.35, color: "#bccaf0", maxWidth: 600 })}>{c.sub}</div>
        </div>
        <div style={flex({ flexDirection: "column", gap: 22 })}>
          <div style={flex({ gap: 10, flexWrap: "wrap" })}>{c.chips.map((t) => <Chip key={t} dark>{t}</Chip>)}</div>
          <div style={flex({ fontSize: 26, fontWeight: 700, color: AMBER })}>{c.domain}</div>
        </div>
      </div>
      <div style={flex({ flex: 1, alignItems: "center", justifyContent: "center", position: "relative" })}>
        <div style={flex({ flexDirection: "column", alignItems: "center", justifyContent: "center", width: 380, height: 380, borderRadius: 48, background: "#fff", boxShadow: "0 30px 70px -10px rgba(0,0,0,0.5)" })}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={310} height={131} alt="" />
        </div>
        <div style={flex({ position: "absolute", right: 36, top: 96, padding: "12px 26px", borderRadius: 9999, background: AMBER, color: INK, fontSize: 28, fontWeight: 700 })}>{String(c.mark ?? "")}</div>
      </div>
    </div>
  );
}

function Bar({ w, color }: { w: number; color: string }) {
  return (
    <div style={flex({ width: "100%", height: 14, borderRadius: 9999, background: "#e3eafa" })}>
      <div style={flex({ width: `${w}%`, height: 14, borderRadius: 9999, background: color })} />
    </div>
  );
}

function Lms({ c, logo }: { c: Card; logo: string }) {
  const rows: [string, number, string][] = [["Robotics, Level 2", 78, BLUE], ["Python basics", 54, "#1b4ed1"], ["Assignment: Line follower", 100, "#16a34a"]];
  return (
    <div style={flex({ width: "100%", height: "100%", background: "#fbfcff", fontFamily: "Figtree", position: "relative" })}>
      <div style={flex({ flexDirection: "column", justifyContent: "space-between", width: 650, padding: "56px 20px 56px 72px" })}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={190} height={81} alt="" />
        <div style={flex({ flexDirection: "column" })}>
          <div style={flex({ fontSize: 64, fontFamily: "Bricolage Grotesque", fontWeight: 800, lineHeight: 1.02, letterSpacing: -2.5, color: INK })}>{c.title}</div>
          <div style={flex({ marginTop: 24, fontSize: 27, lineHeight: 1.35, color: "#3d4b69" })}>{c.sub}</div>
        </div>
        <div style={flex({ flexDirection: "column", gap: 18 })}>
          <div style={flex({ gap: 10, flexWrap: "wrap" })}>{c.chips.map((t) => <Chip key={t}>{t}</Chip>)}</div>
          <div style={flex({ fontSize: 26, fontWeight: 700, color: "#1b4ed1" })}>{c.domain}</div>
        </div>
      </div>
      <div style={flex({ flex: 1, alignItems: "center", justifyContent: "center", background: "#eef3fc" })}>
        <div style={flex({ flexDirection: "column", gap: 26, width: 440, padding: 36, borderRadius: 28, background: "#fff", border: "2px solid #d3dcef", boxShadow: "0 30px 60px -24px rgba(10,31,77,0.3)" })}>
          <div style={flex({ justifyContent: "space-between", alignItems: "center" })}>
            <div style={flex({ fontFamily: "Bricolage Grotesque", fontWeight: 800, fontSize: 30, color: INK })}>My progress</div>
            <div style={flex({ padding: "6px 16px", borderRadius: 9999, background: "#fff7db", color: "#b45309", fontWeight: 700, fontSize: 20 })}>5 day streak</div>
          </div>
          {rows.map(([n, w, col]) => (
            <div key={n} style={flex({ flexDirection: "column", gap: 10 })}>
              <div style={flex({ justifyContent: "space-between", fontSize: 22, fontWeight: 700, color: INK })}><div style={flex()}>{n}</div><div style={flex({ color: "#3d4b69" })}>{`${w}%`}</div></div>
              <Bar w={w} color={col} />
            </div>
          ))}
          <div style={flex({ padding: "14px 20px", borderRadius: 16, background: "#eff6ff", color: NAVY, fontSize: 22, fontWeight: 700 })}>Certificate unlocks at 100%</div>
        </div>
      </div>
    </div>
  );
}

function Academy({ c, logo }: { c: Card; logo: string }) {
  return (
    <div style={flex({ width: "100%", height: "100%", background: "#eef3fc", fontFamily: "Chakra Petch", position: "relative" })}>
      <div style={flex({ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: AMBER })} />
      <div style={flex({ flexDirection: "column", justifyContent: "space-between", width: 690, padding: "56px 20px 56px 76px" })}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={190} height={81} alt="" />
        <div style={flex({ flexDirection: "column" })}>
          <div style={flex({ fontSize: 66, fontWeight: 700, lineHeight: 1.0, letterSpacing: -2.5, color: INK })}>{c.title}</div>
          <div style={flex({ marginTop: 24, fontSize: 27, lineHeight: 1.35, color: "#3d4b69", fontFamily: "Figtree" })}>{c.sub}</div>
        </div>
        <div style={flex({ flexDirection: "column", gap: 18 })}>
          <div style={flex({ gap: 10, flexWrap: "wrap" })}>{c.chips.map((t) => <Chip key={t}>{t}</Chip>)}</div>
          <div style={flex({ fontSize: 26, fontWeight: 500, color: "#1b4ed1" })}>{c.domain}</div>
        </div>
      </div>
      {/* A live-class window: tutor tile, learner tile, session bar. */}
      <div style={flex({ flex: 1, alignItems: "center", justifyContent: "center" })}>
        <div style={flex({ flexDirection: "column", width: 440, borderRadius: 28, background: NAVY, padding: 20, gap: 16, boxShadow: "0 30px 60px -20px rgba(10,31,77,0.55)" })}>
          <div style={flex({ height: 250, borderRadius: 18, background: "#1b4ed1", alignItems: "center", justifyContent: "center", position: "relative" })}>
            <div style={flex({ width: 96, height: 96, borderRadius: 9999, background: "#fff", alignItems: "center", justifyContent: "center", color: BLUE, fontSize: 40, fontWeight: 700 })}>T</div>
            <div style={flex({ position: "absolute", left: 16, top: 16, padding: "6px 14px", borderRadius: 9999, background: "#dc2626", color: "#fff", fontSize: 18, fontWeight: 700 })}>LIVE</div>
            <div style={flex({ position: "absolute", right: 16, bottom: 16, width: 110, height: 76, borderRadius: 12, background: "#2e5aad", border: "3px solid #fff", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 26, fontWeight: 700 })}>You</div>
          </div>
          <div style={flex({ justifyContent: "space-between", alignItems: "center", color: "#bccaf0", fontSize: 21, fontFamily: "Figtree", fontWeight: 700 })}>
            <div style={flex()}>1:1 with your tutor</div>
            <div style={flex({ color: AMBER })}>45 min</div>
          </div>
          <div style={flex({ width: "100%", height: 10, borderRadius: 9999, background: "#2a4380" })}>
            <div style={flex({ width: "62%", height: 10, borderRadius: 9999, background: AMBER })} />
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ image: string }> }) {
  const { image } = await params;
  const c = CARDS[image.replace(/\.png$/, "")];
  if (!c) return new Response("Not found", { status: 404 });

  const root = process.cwd();
  const font = (f: string) => readFile(path.join(root, "src/assets/fonts", f));
  const png = async (f: string) => `data:image/png;base64,${(await readFile(path.join(root, "public", f))).toString("base64")}`;
  const [chakra5, chakra7, brico7, brico8, fig4, fig7, logo] = await Promise.all([
    font("ChakraPetch-Medium.ttf"), font("ChakraPetch-Bold.ttf"), font("Bricolage-Bold.ttf"), font("Bricolage-ExtraBold.ttf"),
    font("Figtree-Regular.ttf"), font("Figtree-Bold.ttf"),
    png(c.theme === "yugminds" ? "Yugminds_Official_Logo-preview.png" : "robocoders-logo.png"),
  ]);

  const View = { yugminds: YugMinds, robocoders: RoboCoders, lms: Lms, academy: Academy }[c.theme];
  return new ImageResponse(<View c={c} logo={logo} />, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Chakra Petch", data: chakra5, weight: 500, style: "normal" },
      { name: "Chakra Petch", data: chakra7, weight: 700, style: "normal" },
      { name: "Bricolage Grotesque", data: brico7, weight: 700, style: "normal" },
      { name: "Bricolage Grotesque", data: brico8, weight: 800, style: "normal" },
      { name: "Figtree", data: fig4, weight: 400, style: "normal" },
      { name: "Figtree", data: fig7, weight: 700, style: "normal" },
    ],
  });
}
