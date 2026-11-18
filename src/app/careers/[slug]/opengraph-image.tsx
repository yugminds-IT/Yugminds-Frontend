import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getBaseURL } from "@/lib/api/axios";

export const alt = "Job opening at YugMinds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

type O = { title: string; location: string; team: string; jobType: string; positions: number; payMin: number | null; payMax: number | null; status: string };

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let o: O | null = null;
  try {
    const r = await fetch(`${getBaseURL()}/careers/openings/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (r.ok) o = (await r.json()) as O;
  } catch {}

  const root = process.cwd();
  const [logo, regular, bold] = await Promise.all([
    readFile(path.join(root, "public", "Yugminds_Official_Logo-preview.png")),
    readFile(path.join(root, "src/assets/fonts/LiberationSans-Regular.ttf")),
    readFile(path.join(root, "src/assets/fonts/LiberationSans-Bold.ttf")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  const title = o?.title ?? "Careers at YugMinds";
  // "Rs", not ₹: the card font has no rupee glyph.
  const pay = o?.payMin && o.payMax ? `Rs ${o.payMin.toLocaleString("en-IN")} – Rs ${o.payMax.toLocaleString("en-IN")} a month` : "";
  const facts = o ? [o.team, o.location, o.jobType, `${o.positions || 1} ${(o.positions || 1) === 1 ? "position" : "positions"}`] : [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 55%, #dbeafe 100%)", fontFamily: "Liberation Sans" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 14, background: "#2563eb" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 40px 56px 80px", width: 780 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#2563eb", letterSpacing: 1 }}>WE ARE HIRING · YugMinds</div>
            <div style={{ marginTop: 20, fontSize: title.length > 28 ? 60 : 76, fontWeight: 700, lineHeight: 1.05, color: "#0f172a", letterSpacing: -2 }}>{title}</div>
            {pay && <div style={{ marginTop: 24, fontSize: 36, fontWeight: 700, color: "#1e3a8a" }}>{pay}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {facts.map((f) => (
                <div key={f} style={{ padding: "9px 18px", borderRadius: 9999, background: "#2563eb", color: "#fff", fontSize: 22, fontWeight: 700 }}>{f}</div>
              ))}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1e3a8a" }}>{`Apply at yugminds.org/careers/${slug}`}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", paddingRight: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 300, height: 300, borderRadius: 40, background: "#fff", boxShadow: "0 30px 60px -20px rgba(30,58,138,0.35)" }}>
            <img src={logoSrc} width={250} height={250} alt="" />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Liberation Sans", data: regular, weight: 400, style: "normal" }, { name: "Liberation Sans", data: bold, weight: 700, style: "normal" }] },
  );
}
