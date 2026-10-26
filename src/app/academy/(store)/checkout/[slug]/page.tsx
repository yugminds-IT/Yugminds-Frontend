"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { academy, type ProductDetail, type Role } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { Price } from "@/components/academy/ProductCard";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Payment window failed to load")));
    s.onerror = () => reject(new Error("Payment window failed to load. Check your connection."));
    document.body.appendChild(s);
  });
}

export default function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  // null = checking; false = signed out; otherwise the account's role.
  const [signedIn, setSignedIn] = useState<Role | false | null>(null);
  const [status, setStatus] = useState<"idle" | "paying" | "verifying">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    academy.catalog.product(slug).then(setProduct).catch((e) => setError(errorText(e)));
    academy.auth
      .me()
      .then((a) => setSignedIn(a.role))
      .catch(() => setSignedIn(false));
  }, [slug]);

  const pay = async () => {
    if (!product) return;
    setError("");
    setStatus("paying");
    try {
      if (product.priceInPaise === 0) {
        const claim = await academy.me.checkout(product.id);
        if ("free" in claim) {
          router.push(claim.product.type === "COURSE" && claim.product.courseId ? `/academy/learn/courses/${claim.product.courseId}` : "/academy/learn/sessions");
        }
        return;
      }
      const [order, Razorpay] = await Promise.all([academy.me.checkout(product.id), loadRazorpay()]);
      if ("free" in order) return; // price changed to ₹0 meanwhile; nothing to pay
      const rzp = new Razorpay({
        key: order.keyId,
        amount: order.amountInPaise,
        currency: order.currency,
        order_id: order.razorpayOrderId,
        name: "RoboCoders Academy",
        description: order.productTitle,
        prefill: order.prefill,
        theme: { color: "#2563EB" },
        handler: async (res: RazorpayResponse) => {
          setStatus("verifying");
          try {
            const data = await academy.me.verify(res);
            router.push(
              data.product.type === "COURSE" && data.product.courseId
                ? `/academy/learn/courses/${data.product.courseId}`
                : "/academy/learn/sessions",
            );
          } catch (e) {
            // The webhook still completes the order; send them to their account.
            setError(`${errorText(e)} — if money was deducted, your purchase will appear in your account shortly.`);
            setStatus("idle");
          }
        },
        modal: { ondismiss: () => setStatus("idle") },
      });
      rzp.on("payment.failed", () => setError("Payment failed. You have not been charged — please try again."));
      rzp.open();
    } catch (e) {
      setError(errorText(e));
      setStatus("idle");
    }
  };

  if (!product && !error) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-ac-brand" /></div>;
  }

  const next = encodeURIComponent(`/academy/checkout/${slug}`);

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-acdisplay font-bold">Checkout</h1>
      {product && (
        <div className="mt-6 rounded-2xl border border-slate-200 p-6">
          <p className="text-sm text-ac-muted">{product.type === "COURSE" ? "Self-paced course" : "Live 1:1 class pack"}</p>
          <p className="mt-1 text-lg font-bold">{product.title}</p>
          <div className="mt-4"><Price product={product} large /></div>

          {signedIn === false ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-ac-muted">Create a free account (or log in) to continue — your course will be saved there.</p>
              <Link href={`/academy/signup?next=${next}`} className="block rounded-lg bg-ac-brand px-6 py-3 text-center font-semibold text-white hover:bg-ac-brand-dark">
                Create account
              </Link>
              <Link href={`/academy/login?next=${next}`} className="block rounded-lg border border-slate-300 px-6 py-3 text-center font-semibold hover:border-ac-brand">
                I already have an account
              </Link>
            </div>
          ) : signedIn && signedIn !== "LEARNER" ? (
            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              You&apos;re signed in with a staff account. Log out and use a learner account to buy.
            </p>
          ) : (
            <button
              onClick={pay}
              disabled={signedIn === null || status !== "idle"}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-ac-brand px-6 py-3.5 font-semibold text-white hover:bg-ac-brand-dark disabled:opacity-60"
            >
              {product.priceInPaise === 0 ? (
                status === "paying" ? "Adding to your account…" : product.type === "COURSE" ? "Enroll free" : "Claim free class"
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {status === "verifying" ? "Confirming payment…" : status === "paying" ? "Opening payment…" : "Pay securely"}
                </>
              )}
            </button>
          )}
          {product.priceInPaise > 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ac-muted">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> UPI, cards, net banking and wallets via Razorpay.
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-4 whitespace-pre-line rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
