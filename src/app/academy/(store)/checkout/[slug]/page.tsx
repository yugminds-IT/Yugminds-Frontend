"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { academy, type ProductDetail, type Role } from "@/lib/academy/api";
import { errorText } from "@/lib/academy/client";
import { Price, kindLabel } from "@/components/academy/ProductCard";

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
    return (
      <section className="ac-top ac-page">
        <div className="rh-wrap"><span className="ac-spin" role="status" aria-label="Loading checkout" /></div>
      </section>
    );
  }

  const next = encodeURIComponent(`/academy/checkout/${slug}`);
  const free = product?.priceInPaise === 0;
  const isCourse = product?.type === "COURSE";
  const learner = signedIn === "LEARNER";
  const staff = !!signedIn && !learner;
  const busy = status !== "idle";

  return (
    <section className="ac-top ac-page" aria-labelledby="ac-co-h">
      <div className="rh-wrap">
        <div className="ac-pagehead">
          <h1 id="ac-co-h" style={{ fontSize: "var(--rh-t-h2)" }}>{free ? "Get it free" : "Checkout"}</h1>
        </div>

        {product && (
          <div className="ac-co">
            <div className="ac-sum">
              <p className="ac-sum-kind">{kindLabel(product)}</p>
              <h2>{product.title}</h2>
              <Price product={product} large />
              {!free && (
                <p className="ac-secure"><ShieldCheck size={16} aria-hidden="true" /> UPI, cards, net banking and wallets through Razorpay.</p>
              )}
              <Link href={`/academy/courses/${product.slug}`} className="ac-back">← Back to details</Link>
            </div>

            <ol className="ac-steps" aria-label="Steps">
              <li data-state={learner ? "done" : "active"}>
                <span aria-hidden="true">1</span>
                <div>
                  <b>{learner ? "Signed in" : "Sign in"}</b>
                  {signedIn === false && (
                    <div className="ac-actions">
                      <p className="ac-hint">Your {isCourse ? "course" : "classes"} will be saved to your account.</p>
                      <Link href={`/academy/signup?next=${next}`} className="rh-btn rh-btn--primary">Create free account</Link>
                      <Link href={`/academy/login?next=${next}`} className="rh-btn rh-btn--ghost">I already have an account</Link>
                    </div>
                  )}
                  {staff && (
                    <p className="ac-note" style={{ marginTop: "0.75rem" }}>
                      You are signed in with a staff account. Log out and use a learner account to buy.
                    </p>
                  )}
                </div>
              </li>
              <li data-state={learner ? "active" : "todo"}>
                <span aria-hidden="true">2</span>
                <div>
                  <b>{free ? "Add it to your account" : "Pay"}</b>
                  {learner && (
                    <div className="ac-actions">
                      <button type="button" onClick={pay} disabled={busy} aria-busy={busy} className="rh-btn rh-btn--primary">
                        {free ? (
                          status === "paying" ? "Adding to your account…" : isCourse ? "Enroll free" : "Claim free class"
                        ) : (
                          <>
                            <Lock size={16} aria-hidden="true" style={{ marginRight: "0.5rem" }} />
                            {status === "verifying" ? "Confirming payment…" : status === "paying" ? "Opening payment…" : "Pay securely"}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </li>
              <li data-state="todo">
                <span aria-hidden="true">3</span>
                <div>
                  <b>{isCourse ? "Start learning" : "Book your first class"}</b>
                  <p className="ac-hint">{isCourse ? "The course opens in your account straight away." : "Pick a tutor and a time from your account."}</p>
                </div>
              </li>
            </ol>
          </div>
        )}

        {error && <p className="ac-note" data-tone="error" role="alert" style={{ marginTop: "1.5rem", whiteSpace: "pre-line" }}>{error}</p>}
      </div>
    </section>
  );
}
