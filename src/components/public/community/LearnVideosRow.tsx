"use client";

import type { CommunityItem } from "@/lib/community-types";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";

function VideoCard({ item, isBlue: _isBlue }: { item: CommunityItem; isBlue: boolean }) {
  const thumb = item.thumbnail_url || item.media_url;
  const inner = (
    <article className="rounded-xl overflow-hidden bg-gray-900 shadow-md group/card hover:shadow-xl transition-shadow">
      <div className="aspect-video relative overflow-hidden">
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb} alt={item.title} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-gray-800" />
        )}
        <div className="absolute inset-0 bg-black/30 group-hover/card:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-blue-600 fill-blue-600 ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-white font-semibold text-sm line-clamp-2 leading-snug">{item.title}</p>
        {item.creator_name && <p className="text-gray-400 text-xs mt-1">{item.creator_name}</p>}
      </div>
    </article>
  );

  if (item.external_url) {
    return (
      <Link href={item.external_url} target="_blank" rel="noopener noreferrer" className="shrink-0 w-[260px] md:w-[300px] block">
        {inner}
      </Link>
    );
  }
  return <div className="shrink-0 w-[260px] md:w-[300px]">{inner}</div>;
}

export function LearnVideosRow({
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
    scrollRef.current?.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  return (
    <section className={`py-10 md:py-14 ${isBlue ? "bg-blue-600" : "bg-gray-50"}`}>
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title={title}
          subtitle="Explore our latest tutorials, product launches, and ideas to spark your creativity and innovation"
          variant={isBlue ? "dark" : "light"}
        />
        <div className="relative group">
          <button onClick={() => scroll("left")} className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll left">
            <ChevronLeft className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => <VideoCard key={item.id} item={item} isBlue={isBlue} />)}
          </div>
          <button onClick={() => scroll("right")} className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll right">
            <ChevronRight className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
