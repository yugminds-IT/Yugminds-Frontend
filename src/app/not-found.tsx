"use client";

import { useRouter } from "next/navigation";
import StatusScreen from "../components/public/StatusScreen";
import { brandHref } from "../lib/brand-host";

export default function NotFound() {
  const router = useRouter();
  return (
    <StatusScreen
      variant="notfound"
      title="This page took a wrong turn."
      text="We couldn't find what you were looking for. It may have moved, or the link may be wrong."
      actions={[{ label: "Go home", href: "/" }, { label: "Go back", onClick: () => router.back(), kind: "ghost" }]}
      links={[
        { label: "Programs", href: brandHref("/robocoders/programs") },
        { label: "Products", href: brandHref("/robocoders/products") },
        { label: "For schools", href: brandHref("/robocoders/for-schools") },
        { label: "Contact us", href: brandHref("/robocoders/contact") },
        { label: "Log in", href: "/lms/login" },
      ]}
    />
  );
}
