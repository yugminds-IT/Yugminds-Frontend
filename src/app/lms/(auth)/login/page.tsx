 "use client";

 import React, { useState, useEffect } from "react";
 import { useRouter } from "next/navigation";
 import { AlertCircle, Info, ShieldAlert, Clock } from "lucide-react";

 import ResizableNavbar from "@/components/ResizableNavbar";
 import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
 import { markFreshLogin } from "@/hooks/useSessionValidation";
 import { shortenUserId } from "@/lib/utils";
 import { setStoredSession, waitForSession, consumeLogoutReason } from "@/lib/session-utils";
 import { authApi, commonApi } from "@/lib/api";
 
 const sampleTestimonials: Testimonial[] = [
   {
     avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
     name: "Sarah Chen",
     handle: "@sarahdigital",
     text: "Amazing platform! The user experience is seamless and the features are exactly what I needed.",
   },
   {
     avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
     name: "Marcus Johnson",
     handle: "@marcustech",
     text: "This service has transformed how I work. Clean design, powerful features, and excellent support.",
   },
   {
     avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
     name: "David Martinez",
     handle: "@davidcreates",
     text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity.",
   },
 ];
 
 const LOGOUT_ICONS = {
   logged_out: <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />,
   session_expired: <ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />,
   session_timeout: <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />,
   wrong_role: <ShieldAlert className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />,
   error: <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />,
 };

 export default function LoginPage() {
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState("");
   const [logoutNotice, setLogoutNotice] = useState<{ title: string; detail: string; icon: React.ReactNode } | null>(null);
   const router = useRouter();

   useEffect(() => {
     const reason = consumeLogoutReason();
     if (reason) {
       // Map reason title back to icon type — consumeLogoutReason returns {title, detail} so
       // we infer the icon by looking at the stored sessionStorage key before it's consumed.
       // Since consumeLogoutReason already removed the key we pass a sensible default icon.
       const icon = reason.title.toLowerCase().includes('signed out')
         ? LOGOUT_ICONS.logged_out
         : reason.title.toLowerCase().includes('access')
         ? LOGOUT_ICONS.wrong_role
         : reason.title.toLowerCase().includes('timed')
         ? LOGOUT_ICONS.session_timeout
         : LOGOUT_ICONS.session_expired;
       setLogoutNotice({ ...reason, icon });
     }
   }, []);
 
   function ErrorMessage() {
     if (!error) return null;
     const errorLines = error.split("\n");
     return (
       <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-50 border-2 border-red-300 text-red-700 px-6 py-4 rounded-lg text-sm z-50 shadow-lg max-w-md w-full mx-4">
         <div className="flex items-start gap-2">
           <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
           <div className="flex-1">
             {errorLines.map((line, idx) => (
               <p key={idx} className={idx === 0 ? "font-medium" : ""}>
                 {line}
               </p>
             ))}
           </div>
         </div>
       </div>
     );
   }
 
   const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
     event.preventDefault();
     setLoading(true);
     setError("");
 
     let loginTimeout: NodeJS.Timeout | null = null;
 
     try {
       const formData = new FormData(event.currentTarget);
       const email = String(formData.get("email") || "").trim();
       const password = String(formData.get("password") || "");
 
       if (!email || !password) {
         setError("Email and password are required.");
         return;
       }
 
       loginTimeout = setTimeout(() => {
         setError("Login is taking too long. Please try again.");
         setLoading(false);
       }, 60000);
 
       const authRes = await authApi.login({ email, password });
       if (loginTimeout) clearTimeout(loginTimeout);
 
       setStoredSession({
         access_token: authRes.tokens.accessToken,
         user: {
           id: String(authRes.user.id),
           email: authRes.user.email,
           mustChangePassword: (authRes.user as { mustChangePassword?: boolean }).mustChangePassword ?? false,
         },
       });
 
       commonApi.auth
         .trackLogin({
           user_id: String(authRes.user.id),
           email,
           success: true,
           ip_address: null,
           user_agent: typeof window !== "undefined" ? window.navigator.userAgent : null,
         })
         .catch(() => {});
 
       await waitForSession(3, 300);
       markFreshLogin();
 
       const role = String(authRes.user.role || "").trim().toLowerCase();
       const roleRoutes: Record<string, string> = {
         admin: "/lms/admin",
         super_admin: "/lms/admin",
         school_admin: "/lms/school-admin",
         teacher: "/lms/teacher",
         student: "/lms/student",
       };
 
       console.log("✅ Login successful:", {
         userId: shortenUserId(String(authRes.user.id)),
         role,
       });
 
       router.push(roleRoutes[role] || "/lms/login");
     } catch (err: unknown) {
       if (loginTimeout) clearTimeout(loginTimeout);
       const apiErr = err as Error & { status?: number };
       const rawMsg = err instanceof Error ? err.message : String(err);

       // Always show a clean, user-friendly message for wrong credentials
       const is401 =
         apiErr.status === 401 ||
         rawMsg.toLowerCase().includes("invalid email") ||
         rawMsg.toLowerCase().includes("unauthorized") ||
         rawMsg === "[object Object]";

       const msg = is401
         ? "Invalid email or password"
         : rawMsg || "Login failed. Please try again.";

       setError(msg);

       commonApi.auth
         .trackLogin({
           email: (() => {
             try {
               const fd = new FormData(event.currentTarget);
               return String(fd.get("email") || "").trim();
             } catch {
               return "";
             }
           })(),
           success: false,
           failure_reason: rawMsg,
           ip_address: null,
           user_agent: typeof window !== "undefined" ? window.navigator.userAgent : null,
         })
         .catch(() => {});
     } finally {
       setLoading(false);
     }
   };
 
   const handleResetPassword = () => router.push("/lms/forgot-password");
   const handleCreateAccount = () => router.push("/lms/signup");
 
   return (
     <div className="bg-background min-h-screen min-w-full text-foreground flex flex-col">
       <ResizableNavbar />
       <ErrorMessage />

       {/* Logout reason banner — shown when user was auto-redirected from a dashboard */}
       {logoutNotice && (
         <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
           {(() => {
             const isNeutral = logoutNotice.title.toLowerCase().includes('signed out');
             return (
               <div className={`flex items-start gap-3 px-5 py-4 rounded-xl shadow-lg text-sm border ${
                 isNeutral
                   ? 'bg-blue-50 border-blue-200 text-blue-900'
                   : 'bg-amber-50 border-amber-300 text-amber-900'
               }`}>
                 {logoutNotice.icon}
                 <div className="flex-1">
                   <p className="font-semibold">{logoutNotice.title}</p>
                   <p className={`mt-0.5 text-xs leading-relaxed ${isNeutral ? 'text-blue-700' : 'text-amber-800'}`}>{logoutNotice.detail}</p>
                 </div>
                 <button
                   onClick={() => setLogoutNotice(null)}
                   className={`ml-2 mt-0.5 flex-shrink-0 ${isNeutral ? 'text-blue-400 hover:text-blue-600' : 'text-amber-500 hover:text-amber-700'}`}
                   aria-label="Dismiss"
                 >
                   ✕
                 </button>
               </div>
             );
           })()}
         </div>
       )}
       <SignInPage
         onSignIn={handleSignIn}
         testimonials={sampleTestimonials}
         onResetPassword={handleResetPassword}
         onCreateAccount={handleCreateAccount}
         heroImageSrc="/image.png"
       />
       {loading && (
         <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
           <div className="bg-white p-6 rounded-lg shadow-lg">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
             <p className="mt-2 text-sm text-gray-600">Signing in...</p>
           </div>
         </div>
       )}
     </div>
   );
 }
