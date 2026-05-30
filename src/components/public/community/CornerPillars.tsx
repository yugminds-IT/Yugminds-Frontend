import Link from "next/link";
import { Sparkles } from "lucide-react";

function seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 30 }, (_, i) => ({
  width:   seeded(i * 5)     * 2 + 1,
  height:  seeded(i * 5 + 1) * 2 + 1,
  top:     seeded(i * 5 + 2) * 100,
  left:    seeded(i * 5 + 3) * 100,
  opacity: seeded(i * 5 + 4) * 0.6 + 0.1,
}));

export function CornerPillars({
  pillars,
  sectionColor = "white",
}: {
  pillars: {
    title: string;
    description: string;
    image_url: string | null;
    link_url: string;
  }[];
  sectionColor?: "blue" | "white";
}) {
  const visible = pillars.slice(0, 3);
  if (visible.length === 0) return null;

  const isBlue = sectionColor === "blue";

  return (
    <section
      className={`py-16 md:py-20 relative overflow-hidden ${
        isBlue ? "bg-blue-600" : "bg-gray-50 border-t border-gray-100"
      }`}
    >
      {/* Star field — only for blue */}
      {isBlue && (
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
          {STARS.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width:   `${s.width}px`,
                height:  `${s.height}px`,
                top:     `${s.top}%`,
                left:    `${s.left}%`,
                opacity: s.opacity * 0.5,
              }}
            />
          ))}
        </div>
      )}

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className={`text-2xl md:text-3xl font-extrabold ${isBlue ? "text-white" : "text-gray-900"}`}>
            Yugminds Corner
          </h2>
          <p className={`text-sm mt-2 ${isBlue ? "text-blue-100" : "text-gray-500"}`}>
            Your gateway to learning, making, and sharing
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {visible.map((pillar) => (
            <Link
              key={pillar.title}
              href={pillar.link_url || "#"}
              className="flex flex-col items-center text-center group"
            >
              <div
                className={`w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden border-4 shadow-lg transition-all duration-300 ${
                  isBlue
                    ? "border-white/30 shadow-blue-900/20 group-hover:border-white/60 group-hover:shadow-blue-900/30"
                    : "border-blue-200 shadow-blue-100 group-hover:border-blue-400 group-hover:shadow-blue-200"
                }`}
              >
                {pillar.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pillar.image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center ${
                      isBlue ? "bg-blue-500/40" : "bg-blue-50"
                    }`}
                  >
                    <Sparkles className={`w-10 h-10 ${isBlue ? "text-white" : "text-blue-500"}`} />
                  </div>
                )}
              </div>
              <h3
                className={`mt-5 text-base font-bold transition-colors ${
                  isBlue
                    ? "text-white group-hover:text-blue-200"
                    : "text-gray-900 group-hover:text-blue-600"
                }`}
              >
                {pillar.title}
              </h3>
              <p
                className={`mt-2 text-sm max-w-[180px] leading-relaxed ${
                  isBlue ? "text-blue-100" : "text-gray-500"
                }`}
              >
                {pillar.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
