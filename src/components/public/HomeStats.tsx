"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Building2, BookOpen, Trophy } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: 2000,
    suffix: "+",
    label: "Students Trained",
    description: "Young minds empowered across India",
  },
  {
    icon: Building2,
    value: 20,
    suffix: "+",
    label: "Partner Schools",
    description: "Trusted by schools nationwide",
  },
  {
    icon: BookOpen,
    value: 3,
    suffix: "",
    label: "Core Programs",
    description: "Coding, AI & Robotics",
  },
  {
    icon: Trophy,
    value: 100,
    suffix: "%",
    label: "Project-Based",
    description: "Every lesson builds something real",
  },
];

function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);

  return count;
}

function StatCard({
  icon: Icon,
  value,
  suffix,
  label,
  description,
  animate,
}: (typeof stats)[0] & { animate: boolean }) {
  const count = useCountUp(value, 1600, animate);
  return (
    <div className="flex flex-col items-center text-center px-6 py-8 group">
      {/* Icon circle */}
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-5 group-hover:bg-blue-200 transition-colors duration-300">
        <Icon className="h-8 w-8 text-blue-600" />
      </div>

      {/* Number */}
      <div className="text-5xl md:text-6xl font-extrabold text-blue-600 mb-2 tabular-nums">
        {animate ? count : 0}
        {suffix}
      </div>

      {/* Label */}
      <div className="text-lg font-bold text-gray-900 mb-1">{label}</div>

      {/* Description */}
      <div className="text-sm text-gray-500 leading-relaxed">{description}</div>
    </div>
  );
}

export default function HomeStats() {
  const ref = useRef<HTMLElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-blue-600 py-20 md:py-24 relative overflow-hidden">
      {/* Subtle dot pattern (matches Features section) */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(#fff 2px, transparent 2px)",
          backgroundSize: "30px 30px",
        }}
      />

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            Robo Coders™ by the Numbers
          </h2>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto">
            Real impact, real students, real results.
          </p>
        </div>

        {/* Divider line */}
        <div className="w-16 h-1 bg-white/30 rounded-full mx-auto mb-14" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          {stats.map((stat, idx) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white border border-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <StatCard {...stat} animate={animate} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
