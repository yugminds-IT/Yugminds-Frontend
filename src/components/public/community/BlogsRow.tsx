"use client";

import type { CommunityItem } from "@/lib/community-types";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";

export function BlogsRow({
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
    scrollRef.current?.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  };

  return (
    <section className={`py-10 md:py-14 ${isBlue ? "bg-blue-600" : "bg-gray-50"}`}>
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title={title}
          subtitle="Explore the latest insights and stories from the forefront of innovation and education in our community"
          variant={isBlue ? "dark" : "light"}
        />
        <div className="relative group">
          <button onClick={() => scroll("left")} className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll left">
            <ChevronLeft className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>

          <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
              const href = item.external_url || "#";
              const thumb = item.media_url || item.thumbnail_url;
              return (
                <Link
                  key={item.id}
                  href={href}
                  target={item.external_url ? "_blank" : undefined}
                  rel={item.external_url ? "noopener noreferrer" : undefined}
                  className="shrink-0 w-[300px] md:w-[340px] rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group/card"
                >
                  <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                    {thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={thumb} alt={item.title} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                        <svg className="w-12 h-12 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-snug">{item.title}</h3>
                    {item.description && (
                      <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {item.description.replace(/<[^>]*>/g, "")}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover/card:text-blue-700">
                      Read More <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <button onClick={() => scroll("right")} className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll right">
            <ChevronRight className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
