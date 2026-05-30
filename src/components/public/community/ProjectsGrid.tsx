import type { CommunityItem } from "@/lib/community-types";
import { Eye, Heart, User } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

export function ProjectsGrid({
  title,
  items,
  sectionColor = "white",
}: {
  title: string;
  items: CommunityItem[];
  sectionColor?: "blue" | "white";
}) {
  const isBlue = sectionColor === "blue";

  return (
    <section className={`py-10 md:py-14 ${isBlue ? "bg-blue-600" : "bg-white"}`}>
      <div className="container mx-auto px-4 md:px-6">
        <SectionHeader
          title={title}
          subtitle="Showcasing the most innovative and impactful creations from the heart of our community"
          variant={isBlue ? "dark" : "light"}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {item.media_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.media_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 line-clamp-2 text-sm leading-snug">{item.title}</h3>
                <div className="flex items-center gap-2 mt-2.5">
                  {item.creator_avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.creator_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-blue-600" />
                    </div>
                  )}
                  <span className="text-xs text-gray-500 truncate">{item.creator_name || "Maker"}</span>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Heart className="w-3.5 h-3.5 text-red-400" />{item.likes.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Eye className="w-3.5 h-3.5 text-blue-400" />{item.views.toLocaleString()}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
