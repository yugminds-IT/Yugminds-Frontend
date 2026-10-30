"use client";

import { authApi } from "@/lib/api";
import { clearStoredSession, setLogoutReason } from "@/lib/session-utils";
import { DevicesAndSessions } from "./DevicesAndSessions";

/** Devices & sessions for the four LMS dashboards (admin, school-admin, teacher, student). */
export function LmsDevices() {
  return (
    <DevicesAndSessions
      api={authApi.sessions}
      onSignedOut={() => {
        // Same exit as the sidebar logout: reason first so the session check can't overwrite it.
        setLogoutReason("logged_out");
        clearStoredSession(true, "logged_out");
        window.location.href = "/lms/login";
      }}
    />
  );
}
