"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { SquiggleUnderline } from "./robo-motion";

const line = {
  hidden: { opacity: 0, y: 34 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.1 + i * 0.1, ease: [0.21, 0.61, 0.35, 1] as const },
  }),
};

export default function HomeHero() {
  return (
    <section className="min-h-screen flex items-center relative overflow-hidden pt-24 lg:pt-20">
      {/* Background Image - Optimized with Next.js Image */}
      <div className="absolute inset-0 pointer-events-none opacity-10 z-0">
        <Image
          src={`/${encodeURI('Doodle icon robotics , coding background.png')}`}
          alt="Robotics and coding background pattern"
          fill
          className="object-cover"
          quality={60}
          sizes="100vw"
          priority={false}
          loading="lazy"
        />
      </div>
      <div className="w-full relative z-10">
        <div className="flex flex-col lg:flex-row items-center lg:items-center gap-0">
          {/* Left Column - Text */}
          <div className="flex-1 w-full flex flex-col justify-center pl-8 pr-4 md:pl-16 md:pr-8 lg:pl-24 lg:pr-12 xl:pl-32 xl:pr-16 py-12 md:py-16 lg:py-16 text-center lg:text-left">
            <div className="relative z-10 max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto lg:mx-0">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs md:text-sm font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6"
              >
                <Sparkles className="w-3.5 h-3.5" /> STEM Education by YugMinds
              </motion.p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold leading-tight max-w-full">
                {[
                  <span key="l1" className="block text-gray-900 font-extrabold">Empowering</span>,
                  <span key="l2" className="block text-gray-900 font-extrabold">Students to</span>,
                  <span key="l3" className="block text-blue-600 font-extrabold">Code, Create,</span>,
                  <span key="l4" className="relative block text-blue-600 font-extrabold">
                    and Innovate
                    <SquiggleUnderline className="absolute -bottom-2 left-1/2 lg:left-0 -translate-x-1/2 lg:translate-x-0 w-56 md:w-72 h-4 text-amber-400" />
                  </span>,
                ].map((content, i) => (
                  <motion.span
                    key={i}
                    className="block"
                    custom={i}
                    initial="hidden"
                    animate="show"
                    variants={line}
                  >
                    {content}
                  </motion.span>
                ))}
              </h1>
              <motion.p
                custom={4}
                initial="hidden"
                animate="show"
                variants={line}
                className="mt-8 text-gray-700 text-base md:text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                Join Robo Coders™ and discover the exciting world of AI, robotics, and programming.
                Build the future, one line of code at a time.
              </motion.p>
              <motion.div
                custom={5}
                initial="hidden"
                animate="show"
                variants={line}
                className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link href="/programs" className="w-full sm:w-auto">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Button size="lg" className="w-full sm:w-auto px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/25 group">
                      Explore Programs <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </motion.div>
                </Link>
                <Link href="/contact" className="w-full sm:w-auto">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Button variant="outline" className="w-full sm:w-auto px-8 text-lg border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full" size="lg">
                      Book a Demo
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>
            </div>
          </div>
          {/* Right Column - Image */}
          <motion.div
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.21, 0.61, 0.35, 1] }}
            className="w-full lg:w-[45%] xl:w-[50%] relative h-[300px] sm:h-[400px] md:h-[450px] lg:h-[calc(100vh-8rem)] lg:min-h-[480px] lg:max-h-[820px] rounded-none lg:rounded-l-[61px] overflow-hidden bg-white shadow-2xl"
          >
            <Image
              src="/image.png"
              alt="Students Learning STEM Activity"
              fill
              sizes="(max-width: 1023px) 100vw, (max-width: 1279px) 45vw, 50vw"
              className="object-cover max-w-full max-h-full"
              priority
            />
            <div className="absolute left-0 top-0 bottom-0 w-[10px] lg:w-[20px] bg-blue-600 lg:rounded-l-[61px] z-20 pointer-events-none"></div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
