import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Brand } from "../../../lib/brand-host";

export const dynamic = "force-static";
export const dynamicParams = false;

type Card = {
  logo: string;
  logoWidth: number;
  logoHeight: number;
  eyebrow: string;
  headline: string;
  tagline: string;
  pills: string[];
  domain: string;
};

const CARDS: Record<Brand, Card> = {
  yugminds: {
    logo: "Yugminds_Official_Logo-preview.png",
    logoWidth: 340,
    logoHeight: 340,
    eyebrow: "YugMinds · Hyderabad, India",
    headline: "Software, Electronics & STEM Education",
    tagline: "Building software, electronics and machines under one roof — and teaching the next generation.",
    pills: ["Software", "Electronics", "Manufacturing", "RoboCoders"],
    domain: "yugminds.org",
  },
  robocoders: {
    logo: "robocoders-logo.png",
    logoWidth: 380,
    logoHeight: 161,
    eyebrow: "RoboCoders by YugMinds",
    headline: "Coding, Robotics & AI for Students",
    tagline: "Hands-on STEM programs for ages 6–18, with kits, textbooks and certificates.",
    pills: ["Coding", "Robotics", "AI", "Ages 6–18"],
    domain: "robocoders.yugminds.org",
  },
  lms: {
    logo: "robocoders-logo.png",
    logoWidth: 380,
    logoHeight: 161,
    eyebrow: "RoboCoders LMS",
    headline: "Learn, Practise & Track Progress",
    tagline: "Courses, assignments, attendance and certificates for schools, teachers and students.",
    pills: ["Courses", "Assignments", "Attendance", "Certificates"],
    domain: "lms.yugminds.org",
  },
  academy: {
    logo: "robocoders-logo.png",
    logoWidth: 380,
    logoHeight: 161,
    eyebrow: "RoboCoders Academy",
    headline: "Online Courses & Live 1:1 Classes",
    tagline: "Self-paced coding, robotics and AI courses, plus live sessions with expert tutors.",
    pills: ["Self-paced", "Live 1:1", "Certificates", "Ages 6–18"],
    domain: "academy.yugminds.org",
  },
};

export function generateStaticParams() {
  return Object.keys(CARDS).map((brand) => ({ image: `${brand}.png` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ image: string }> }) {
  const { image } = await params;
  const card = CARDS[image.replace(/\.png$/, "") as Brand];
  if (!card) return new Response("Not found", { status: 404 });

  const root = process.cwd();
  const [logo, regular, bold] = await Promise.all([
    readFile(path.join(root, "public", card.logo)),
    readFile(path.join(root, "src/assets/fonts/LiberationSans-Regular.ttf")),
    readFile(path.join(root, "src/assets/fonts/LiberationSans-Bold.ttf")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 55%, #dbeafe 100%)",
          fontFamily: "Liberation Sans",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, rgba(37,99,235,0) 70%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: "#2563eb" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 40px 56px 80px",
            width: 720,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#2563eb", letterSpacing: 1 }}>
              {card.eyebrow}
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 58,
                fontWeight: 700,
                lineHeight: 1.08,
                color: "#0f172a",
                letterSpacing: -1.5,
              }}
            >
              {card.headline}
            </div>
            <div style={{ marginTop: 22, fontSize: 28, lineHeight: 1.35, color: "#475569" }}>
              {card.tagline}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {card.pills.map((pill) => (
                <div
                  key={pill}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 9999,
                    background: "#2563eb",
                    color: "#ffffff",
                    fontSize: 20,
                    whiteSpace: "nowrap",
                    fontWeight: 600,
                  }}
                >
                  {pill}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: "#1e3a8a" }}>{card.domain}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 56 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 420,
              height: 420,
              borderRadius: 40,
              background: "#ffffff",
              boxShadow: "0 30px 60px -20px rgba(30,58,138,0.35)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={card.logoWidth} height={card.logoHeight} alt="" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Liberation Sans", data: regular, weight: 400, style: "normal" },
        { name: "Liberation Sans", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
