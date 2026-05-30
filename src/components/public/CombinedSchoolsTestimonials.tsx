"use client";

import { useEffect, useState, useMemo } from "react";
import AutoScroll from "embla-carousel-auto-scroll";
import { TestimonialSlider, type Testimonial } from "../ui/testimonial-slider";
import { Star, Award } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "../ui/carousel";
import { apiClient } from "../../lib/api";

interface Logo {
  id: string;
  description: string;
  image: string;
  className?: string;
}

const testimonialsData: Testimonial[] = [
  {
    id: 1,
    initials: "SG",
    name: "Student, Grade 9",
    role: "Robotics Enthusiast",
    quote: "Robo Coders transformed my understanding of tech. I built my first robot and even won a science fair!",
    tags: [{ text: "Robotics", type: "featured" }, { text: "Science Fair", type: "default" }],
    stats: [{ icon: Star, text: "5.0 Rating" }, { icon: Award, text: "Winner" }],
    avatarGradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
  },
  {
    id: 2,
    initials: "P",
    name: "Parent",
    role: "Satisfied Parent",
    quote: "My son's confidence has soared since joining. The instructors genuinely care about each student.",
    tags: [{ text: "Confidence Building", type: "featured" }, { text: "Expert Instructors", type: "default" }],
    stats: [{ icon: Star, text: "5.0 Rating" }],
    avatarGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
  },
  {
    id: 3,
    initials: "S8",
    name: "Student, Grade 8",
    role: "Game Developer",
    quote: "The coding skills I learned here helped me create my own Games . Thank you Robo Coders!",
    tags: [{ text: "Coding", type: "featured" }, { text: "Game Development", type: "default" }],
    stats: [{ icon: Star, text: "5.0 Rating" }, { icon: Award, text: "Game Creator" }],
    avatarGradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)"
  }
];

const EMPTY_LOGOS: Logo[] = [];

export default function CombinedSchoolsTestimonials() {
  const [dynamicLogos, setDynamicLogos] = useState<Logo[]>(EMPTY_LOGOS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false); // true only on network/HTTP failure, NOT on empty list

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function run() {
      try {
        setIsLoading(true);
        setHasError(false);

        const timeoutId = setTimeout(() => ac.abort(), 12000);
        const { data } = await apiClient
          .get('/api/logos', { signal: ac.signal })
          .finally(() => clearTimeout(timeoutId));

        const list = Array.isArray((data as { logos?: unknown })?.logos)
          ? (((data as { logos?: unknown })?.logos ?? []) as Array<{ id: string; image_url?: string; school_name?: string; description?: string }>)
          : [];
        const valid: Logo[] = list
          .filter((l) => typeof l?.image_url === "string" && l.image_url.trim() !== "")
          .map((l) => ({
            id: l.id,
            image: l.image_url!,
            description: l.school_name || l.description || '',
          }));

        if (cancelled) return;

        // Empty logos is not an error — just hide the section silently
        setDynamicLogos(valid);
        setHasError(false);
      } catch (e) {
        if (cancelled) return;
        if (!(e instanceof Error && e.name === "AbortError")) {
          console.warn("Failed to load logos:", e);
          setHasError(true);
        }
        setDynamicLogos([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  // Duplicate logos for seamless infinite scroll — only when there are enough to scroll
  const duplicatedLogos = useMemo(() => {
    if (dynamicLogos.length === 0) return [];
    // Need at least ~6 items to fill the carousel visually; repeat until we have enough
    const minItems = 6;
    const copies = Math.ceil(minItems / dynamicLogos.length);
    return Array.from({ length: Math.max(copies, 3) }, () => dynamicLogos).flat();
  }, [dynamicLogos]);

  // Memoize the AutoScroll plugin
  const autoScrollPlugin = useMemo(() => {
    if (dynamicLogos.length === 0) return null;
    return AutoScroll({
      playOnInit: true,
      speed: 1.5,
      direction: 'backward',
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
      startDelay: 0,
    });
  }, [dynamicLogos.length]);

  return (
    <>
      {/* Our Leading Schools Section — hidden entirely when there are no logos */}
      {(isLoading || dynamicLogos.length > 0) && (
      <section
        id="leading-schools"
        className="bg-white py-12 md:py-16"
      >
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Our Leading Schools
            </h2>
          </div>
          <div className="pt-4 md:pt-6">
            <div className="relative mx-auto flex items-center justify-center max-w-screen-xl overflow-hidden min-h-[200px]">
              {isLoading && (
                <div className="flex items-center justify-center w-full py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 text-sm">Loading school logos...</p>
                  </div>
                </div>
              )}

              {!isLoading && hasError && (
                <div className="flex items-center justify-center w-full py-12">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm mb-4">Unable to load logos at this time</p>
                    <button
                      onClick={() => {
                        setIsLoading(true);
                        setHasError(false);
                        setDynamicLogos([]);
                        window.location.reload();
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {!isLoading && !hasError && dynamicLogos.length > 0 && autoScrollPlugin && (
                <>
                  <Carousel
                    opts={{ loop: true, align: 'start', dragFree: true, skipSnaps: false }}
                    plugins={[autoScrollPlugin]}
                    className="w-full"
                  >
                    <CarouselContent className="ml-0">
                      {duplicatedLogos.map((logo, index) => (
                        <CarouselItem
                          key={`${logo.id}-${index}`}
                          className="flex basis-1/3 justify-center pl-0 sm:basis-1/4 md:basis-1/5 lg:basis-1/6"
                        >
                          <div className="mx-6 md:mx-10 flex shrink-0 items-center justify-center min-h-[80px] md:min-h-[112px] lg:min-h-[128px]">
                            <div className="relative w-full flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={logo.image}
                                alt={logo.description || 'School logo'}
                                className={logo.className || "h-20 md:h-28 lg:h-32 w-auto opacity-60 hover:opacity-100 transition-opacity max-w-[150px] object-contain"}
                                loading="lazy"
                                decoding="async"
                                crossOrigin="anonymous"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  console.warn('Failed to load logo image:', logo.image, 'for school:', logo.description);
                                }}
                                onLoad={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'block';
                                  console.log('Successfully loaded logo:', logo.description);
                                }}
                              />
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                  <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none z-10"></div>
                  <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-10"></div>
                </>
              )}
              
              {!isLoading && !hasError && dynamicLogos.length > 0 && !autoScrollPlugin && (
                <div className="flex items-center justify-center w-full py-12">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm">Logos loaded ({dynamicLogos.length}) but carousel not initialized</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      )} {/* end leading-schools conditional */}

      {/* What Our Students and Parents Say Section - Blue Background */}
      <section
        id="testimonials"
        className="bg-blue-600 py-12 md:py-16 relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#fff 2px, transparent 2px)", backgroundSize: "30px 30px" }}></div>
        
        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-10 md:mb-12">
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6 max-w-5xl mx-auto">What Our Students and Parents Say</h3>
            <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto">Real feedback from our community of learners and families</p>
          </div>
          <div className="w-full flex items-center justify-center">
            <div className="w-full max-w-5xl mx-auto relative">
              <TestimonialSlider testimonials={testimonialsData} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

