import type { Tutor } from "@/lib/academy/api";

export function TutorAvatar({ tutor, size = "3.5rem" }: { tutor: Pick<Tutor, "name" | "photoUrl">; size?: string }) {
  const style = { "--s": size } as React.CSSProperties;
  return tutor.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- tutor photo URL, may be any host
    <img src={tutor.photoUrl} alt="" className="ac-avatar" style={style} />
  ) : (
    <span className="ac-avatar" style={style} aria-hidden="true">{tutor.name.charAt(0).toUpperCase() || "T"}</span>
  );
}
