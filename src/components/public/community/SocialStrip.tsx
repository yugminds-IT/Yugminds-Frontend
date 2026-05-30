import Link from "next/link";
import { Facebook, Instagram, Linkedin, Youtube, MessageCircle } from "lucide-react";

const PLATFORM_CONFIG: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  youtube:   { Icon: Youtube,       color: "text-red-600",    bg: "bg-red-50" },
  facebook:  { Icon: Facebook,      color: "text-blue-700",   bg: "bg-blue-50" },
  linkedin:  { Icon: Linkedin,      color: "text-blue-600",   bg: "bg-blue-50" },
  instagram: { Icon: Instagram,     color: "text-pink-600",   bg: "bg-pink-50" },
  whatsapp:  { Icon: MessageCircle, color: "text-green-600",  bg: "bg-green-50" },
};

export function SocialStrip({
  links,
}: {
  links: { platform: string; label: string; url: string }[];
}) {
  const active = links.filter((l) => l.url?.trim());
  if (active.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-blue-600">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
          Yugminds Social Handles
        </h2>
        <p className="text-blue-100 text-sm mb-10 max-w-lg mx-auto">
          Connect, follow, and engage with our community on popular social media platforms
        </p>

        <div className="flex flex-wrap justify-center gap-8 md:gap-12">
          {active.map((link) => {
            const cfg = PLATFORM_CONFIG[link.platform.toLowerCase()];
            const Icon = cfg?.Icon || Youtube;
            const iconColor = cfg?.color || "text-gray-600";
            const iconBg = cfg?.bg || "bg-gray-50";

            return (
              <Link
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 group"
              >
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full ${iconBg} border-4 border-white/30 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:border-white/60 transition-all`}>
                  <Icon className={`w-7 h-7 md:w-9 md:h-9 ${iconColor}`} />
                </div>
                <span className="font-semibold text-white text-sm">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
