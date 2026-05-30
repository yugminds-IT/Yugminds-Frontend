"use client";

import type { CommunityItem } from "@/lib/community-types";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import { SectionHeader } from "./SectionHeader";

function isVideo(url: string | null) {
  return url ? /\.(mp4|webm|mov|m4v|ogg|ogv)(\?.*)?$/i.test(url) : false;
}

function getYouTubeId(url: string): string | null {
  const shorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shorts) return shorts[1];
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  return null;
}

function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function ReelCard({ item }: { item: CommunityItem }) {
  const isDirectVideo = isVideo(item.media_url);
  const thumbSrc =
    item.thumbnail_url ||
    (!isDirectVideo ? item.media_url : null) ||
    (item.external_url ? getYouTubeThumbnail(item.external_url) : null);

  const inner = (
    <div className="relative w-full h-full">
      {isDirectVideo && item.media_url ? (
        <video src={item.media_url} className="absolute inset-0 w-full h-full object-cover" muted playsInline loop />
      ) : thumbSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={thumbSrc} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gray-800" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
      <div className="absolute top-3 left-3 right-3 flex items-center gap-2">
        {item.creator_avatar_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.creator_avatar_url} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-white shrink-0 flex items-center justify-center text-xs font-bold text-white">
            {(item.creator_name || "S").charAt(0)}
          </div>
        )}
        <span className="text-white text-xs font-semibold truncate drop-shadow">{item.creator_name || "Student"}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center group-hover/card:bg-white/45 transition-colors shadow-lg">
          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
        </div>
      </div>
      <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-semibold line-clamp-2 leading-snug drop-shadow">{item.title}</p>
    </div>
  );

  const cardClass = "snap-start shrink-0 w-[160px] md:w-[190px] rounded-2xl overflow-hidden bg-gray-900 shadow-md relative aspect-[9/16] group/card hover:shadow-xl transition-shadow";
  if (item.external_url) {
    return <a href={item.external_url} target="_blank" rel="noopener noreferrer" className={cardClass} title={item.title}>{inner}</a>;
  }
  return <article className={cardClass}>{inner}</article>;
}

export function ReelsRow({
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
    scrollRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  };

  return (
    <section className={`py-10 md:py-14 ${isBlue ? "bg-blue-600" : "bg-white"}`}>
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title={title}
          subtitle="Explore fun DIY builds, STEM challenges, and cool tech tips in under 60 seconds"
          variant={isBlue ? "dark" : "light"}
        />
        <div className="relative group">
          <button onClick={() => scroll("left")} className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll left">
            <ChevronLeft className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
          <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
            {items.map((item) => <ReelCard key={item.id} item={item} />)}
          </div>
          <button onClick={() => scroll("right")} className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isBlue ? "bg-blue-700 border-blue-500 hover:bg-blue-800" : "bg-white border-gray-200 hover:bg-gray-50"}`} aria-label="Scroll right">
            <ChevronRight className={`w-5 h-5 ${isBlue ? "text-white" : "text-gray-700"}`} />
          </button>
        </div>
      </div>
    </section>
  );
}
