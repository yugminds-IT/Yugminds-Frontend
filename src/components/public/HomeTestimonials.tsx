"use client";

import { Star, Award } from "lucide-react";
import { TestimonialSlider, type Testimonial } from "../ui/testimonial-slider";

const testimonialsData: Testimonial[] = [
  {
    id: 1,
    initials: "SG",
    name: "Student, Grade 9",
    role: "Robotics Enthusiast",
    quote:
      "Robo Coders transformed my understanding of tech. I built my first robot and even won a science fair!",
    tags: [
      { text: "Robotics", type: "featured" },
      { text: "Science Fair", type: "default" },
    ],
    stats: [{ icon: Star, text: "5.0 Rating" }, { icon: Award, text: "Winner" }],
    avatarGradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  },
  {
    id: 2,
    initials: "P",
    name: "Parent",
    role: "Satisfied Parent",
    quote:
      "My son's confidence has soared since joining. The instructors genuinely care about each student.",
    tags: [
      { text: "Confidence Building", type: "featured" },
      { text: "Expert Instructors", type: "default" },
    ],
    stats: [{ icon: Star, text: "5.0 Rating" }],
    avatarGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  {
    id: 3,
    initials: "S8",
    name: "Student, Grade 8",
    role: "Game Developer",
    quote:
      "The coding skills I learned here helped me create my own games. Thank you Robo Coders!",
    tags: [
      { text: "Coding", type: "featured" },
      { text: "Game Development", type: "default" },
    ],
    stats: [
      { icon: Star, text: "5.0 Rating" },
      { icon: Award, text: "Game Creator" },
    ],
    avatarGradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
  },
];

export default function HomeTestimonials() {
  return (
    <section id="testimonials" className="bg-white py-16 md:py-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">

        {/* Label pill */}
        <div className="flex justify-center mb-5">
          <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm font-semibold px-4 py-2 rounded-full border border-blue-100">
            <Star className="h-4 w-4 fill-blue-600" />
            Student &amp; Parent Reviews
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-4">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 max-w-3xl mx-auto leading-tight">
            What Our Students and Parents Say
          </h2>
          <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto">
            Real feedback from our community of learners and families.
          </p>
        </div>

        {/* Blue accent divider */}
        <div className="w-16 h-1 bg-blue-600 rounded-full mx-auto mt-6 mb-12" />

        {/* Slider */}
        <div className="w-full flex items-center justify-center">
          <div className="w-full max-w-5xl mx-auto">
            <TestimonialSlider testimonials={testimonialsData} />
          </div>
        </div>

      </div>
    </section>
  );
}
