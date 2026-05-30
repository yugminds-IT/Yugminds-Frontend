import { Award, Star, Trophy } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  award: Award,
  star: Star,
};

export function ImpactStats({
  stats,
  sectionColor = "white",
}: {
  stats: { value: string; label: string; icon: string }[];
  sectionColor?: "blue" | "white";
}) {
  if (!stats.length) return null;
  const isBlue = sectionColor === "blue";

  return (
    <section className={`py-12 md:py-16 border-t border-gray-100 ${isBlue ? "bg-blue-600" : "bg-white"}`}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className={`text-2xl md:text-3xl font-extrabold ${isBlue ? "text-white" : "text-gray-900"}`}>
            Impact by the Numbers
          </h2>
          <p className={`text-sm mt-2 max-w-xl mx-auto ${isBlue ? "text-blue-100" : "text-gray-500"}`}>
            See how our students are excelling and achieving remarkable results
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {stats.map((stat) => {
            const Icon = ICON_MAP[stat.icon?.toLowerCase()] || Trophy;
            return (
              <div key={stat.label} className="flex flex-col items-center text-center p-8 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Icon className="h-7 w-7 text-blue-600" />
                </div>
                <div className="text-4xl font-extrabold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-gray-600 font-medium text-sm">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
