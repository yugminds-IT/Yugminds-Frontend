import { permanentRedirect } from "next/navigation";

// YugMinds is a single page now; this old address points to its section.
export default function Page() {
  permanentRedirect("/#about");
}
