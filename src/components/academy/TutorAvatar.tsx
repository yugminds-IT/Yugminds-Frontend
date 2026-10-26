import type { Tutor } from "@/lib/academy/api";

export function TutorAvatar({ tutor, size = "h-16 w-16" }: { tutor: Pick<Tutor, "name" | "photoUrl">; size?: string }) {
  return tutor.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- tutor photo URL, may be any host
    <img src={tutor.photoUrl} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-ac-soft text-xl font-bold text-ac-brand`}>
      {tutor.name.charAt(0).toUpperCase() || "T"}
    </span>
  );
}
