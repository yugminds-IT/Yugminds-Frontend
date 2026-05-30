import type { CommunityItem } from "@/lib/community-types";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export function ChallengeBanner({ items }: { items: CommunityItem[] }) {
  const featured = items.find((i) => i.is_featured) || items[0];
  if (!featured) return null;

  const others = items.filter((i) => i.id !== featured.id).slice(0, 3);

  return (
    <section className="py-10 md:py-14 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title="Yugminds Challenges"
          subtitle="Competitions designed to inspire and test the innovative spirit of students worldwide"
        />

        {/* Featured challenge */}
        <div className="rounded-2xl overflow-hidden bg-blue-600 text-white mb-6 shadow-lg">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-semibold w-fit mb-4">
                <Trophy className="w-3.5 h-3.5" /> Featured Challenge
              </div>
              <h3 className="text-2xl md:text-3xl font-extrabold leading-tight">{featured.title}</h3>
              {featured.description && (
                <p className="mt-3 text-blue-100 text-sm md:text-base leading-relaxed line-clamp-3">
                  {featured.description.replace(/<[^>]*>/g, "")}
                </p>
              )}
              {featured.cta_url && (
                <Link
                  href={featured.cta_url}
                  className="mt-6 inline-flex items-center gap-2 bg-white text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors w-fit text-sm"
                >
                  {featured.cta_label || "Join Now"} <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <div className="flex items-center justify-center p-6 md:p-10 bg-blue-700/30">
              {featured.media_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={featured.media_url}
                  alt={featured.title}
                  className="max-h-[220px] w-full object-contain drop-shadow-xl"
                />
              ) : (
                <div className="w-36 h-36 rounded-full bg-white/10 flex items-center justify-center">
                  <Trophy className="w-16 h-16 text-white/60" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other challenges */}
        {others.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow flex gap-4 items-start"
              >
                {item.media_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.media_url}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Trophy className="w-7 h-7 text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm line-clamp-2">{item.title}</h4>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {item.description.replace(/<[^>]*>/g, "")}
                    </p>
                  )}
                  {item.cta_url && (
                    <Link
                      href={item.cta_url}
                      className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      {item.cta_label || "Learn More"} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
