"use client";

import type { CommunityItem } from "@/lib/community-types";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";

export function ProfilesRow({
  title,
  items,
  sectionColor = "white",
}: {
  title: string;
  items: CommunityItem[];
  sectionColor?: "blue" | "white";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBlue = sectionColor === "blue";

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -260 : 260, behavior: "smooth" });
  };

  return (
    <section className={`py-10 md:py-14 ${isBlue ? "bg-blue-600" : "bg-gray-50"}`}>
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title={title}
          subtitle="Celebrating the most engaged and creative members of the Yugminds Community"
          variant={isBlue ? "dark" : "light"}
        />
        <div className="relative group">
          <button onClick={() => scroll("left")} className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll left">
            <ChevronLeft className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>

          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => (
              <article key={item.id} className="shrink-0 w-[200px] md:w-[220px] rounded-2xl border border-gray-100 bg-white p-5 shadow-sm text-center hover:shadow-md transition-shadow">
                {item.creator_avatar_url || item.media_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.creator_avatar_url || item.media_url!} alt={item.title} className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-blue-50 shadow-sm" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 mx-auto flex items-center justify-center text-2xl font-bold text-blue-600 border-4 border-blue-50">
                    {item.title.charAt(0)}
                  </div>
                )}
                <h3 className="mt-3 font-bold text-gray-900 text-sm leading-tight">{item.title}</h3>
                {item.subtitle && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.subtitle}</p>}
                <div className="flex items-center justify-center gap-1 mt-2 text-xs text-gray-400">
                  <Users className="w-3 h-3" />
                  <span>{item.views > 0 ? `${item.views.toLocaleString()} Followers` : "Community Member"}</span>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {item.cta_url && (
                    <Link href={item.cta_url} className="w-full text-center text-sm font-semibold py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                      {item.cta_label || "Follow"}
                    </Link>
                  )}
                  {item.external_url && (
                    <Link href={item.external_url} className="w-full text-center text-sm font-semibold py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors">
                      View Profile
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>

          <button onClick={() => scroll("right")} className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll right">
            <ChevronRight className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
