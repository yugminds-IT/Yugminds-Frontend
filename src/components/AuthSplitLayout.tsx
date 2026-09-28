"use client";

import Image from "next/image";
import ResizableNavbar from "@/components/ResizableNavbar";

/** Full-height left image shared by the LMS login, signup and forgot-password pages. */
export function AuthHeroImage() {
  return (
    <section className="relative hidden md:block md:w-[48%] shrink-0 bg-[#030712]">
      <Image
        src="/login-hero.png"
        alt="Student looking up at a friendly robot under a neon ring over a night city"
        fill
        priority
        sizes="48vw"
        className="object-cover object-center"
      />
    </section>
  );
}

/** White navbar, image on the left, scrollable form column on the right. */
export default function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white text-foreground">
      <ResizableNavbar solid />
      <div className="flex h-[100dvh] pt-[68px]">
        <AuthHeroImage />
        <section className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-8">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
