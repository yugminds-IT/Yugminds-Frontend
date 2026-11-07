"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Award, Download, ExternalLink, Eye, Loader2, X } from "lucide-react";
import { useStudentCertificates, useStudentCourses } from "@/hooks/useStudentData";
import { toast } from "@/components/ui/toast";
import { studentApi } from "@/lib/api";
import { getVerifyCertUrl } from "@/lib/brand-host";
import ThresholdTrack from "@/components/portal/ThresholdTrack";

/** The backend stores "pending" until the certificate image has been drawn and uploaded. */
const isRenderedUrl = (url?: string): url is string =>
  !!url && url.trim() !== "" && !url.startsWith("pending");

/**
 * Downloads a certificate through the authenticated backend proxy.
 * A plain `<a download>` is a no-op for cross-origin (S3/CDN) URLs, and a
 * direct browser `fetch()` of the S3 URL fails unless the bucket has CORS
 * configured for this origin — the backend already holds S3 credentials, so
 * proxying through it sidesteps both problems.
 */
async function downloadCertificate(id: string, name: string) {
  const res = await studentApi.certificates.download(id);
  const blob = res.data as Blob;
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : "jpg";
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${name}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

const THRESHOLD = 80;

type StudentCourse = { id: string; name?: string; title?: string; progress_percentage: number; status?: string; average_grade?: number; grade?: string; subject?: string };
type Certificate = { id: string; short_id?: string; course_id?: string; courses?: { id?: string; name?: string; title?: string; grade?: string; subject?: string }; certificate_name: string; certificate_url?: string; status?: string; revoked_reason?: string | null; issued_at: string; issued_by?: string };

export default function CertificatesPage() {
  const { data: certificates, isLoading: certificatesLoading } = useStudentCertificates();
  const { data: courses } = useStudentCourses();
  const queryClient = useQueryClient();
  const [generatingCertId, setGeneratingCertId] = useState<string | null>(null);
  const [previewCert, setPreviewCert] = useState<{ id: string; url: string; name: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The full-size viewer closes with Escape and starts with focus inside it.
  useEffect(() => {
    if (!previewCert) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreviewCert(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewCert]);

  const handleDownload = async (id: string, name: string) => {
    try {
      await downloadCertificate(id, name);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 403 ? "This certificate has been taken back"
          : status === 404 ? "The certificate file is missing. Ask your administrator to make it again."
          : "The certificate did not download. Try again.",
      );
    }
  };

  const certs = (certificates ?? []) as Certificate[];
  const earnedCount = certs.filter((c) => c.status !== "revoked").length;
  const coursesList = (courses as StudentCourse[] | undefined) || [];
  const eligibleCourses = coursesList.filter((course) => course.progress_percentage >= THRESHOLD);
  const inProgressCourses = coursesList
    .filter((course) => course.progress_percentage < THRESHOLD)
    .sort((a, b) => b.progress_percentage - a.progress_percentage);

  // Only offer "get certificate" if the course is 80%+ and has no certificate (a revoked one can't be remade by the student).
  const eligibleCoursesWithoutCert = eligibleCourses.filter((course) => {
    if (certs.length === 0) return true;
    const has = certs.some((cert) => {
      const courseMatches = cert.course_id === course.id || cert.courses?.id === course.id;
      return courseMatches && (cert.status === "revoked" || isRenderedUrl(cert.certificate_url));
    });
    return !has;
  });

  // Manual generation (fallback; certificates normally arrive by themselves)
  const handleRequestCertificate = async (courseId: string) => {
    setGeneratingCertId(courseId);
    try {
      const { data } = await studentApi.certificates.generate({ courseId });
      const payload = data as { success?: boolean; error?: string };
      if (payload.success) {
        toast.success("Your certificate is ready!");
        queryClient.invalidateQueries({ queryKey: ["studentCertificates"] });
      } else {
        toast.error(payload.error || "We could not make your certificate. Try again later.");
      }
    } catch (error: unknown) {
      console.error("Error generating certificate:", error);
      const msg =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.response?.data?.message ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.message ||
        "Something went wrong. Try again later.";
      toast.error(msg);
    } finally {
      setGeneratingCertId(null);
    }
  };

  const graded = coursesList.filter((c) => c.average_grade != null);
  const avgGrade = graded.length > 0 ? Math.round(graded.reduce((acc, c) => acc + (c.average_grade ?? 0), 0) / graded.length) : null;
  const courseName = (c: StudentCourse) => c.name || c.title || "Course";

  // The course the track follows: one ready to collect, else the closest one, else the best one.
  const focus = eligibleCoursesWithoutCert[0] ?? inProgressCourses[0] ?? eligibleCourses[0] ?? null;
  const focusPct = focus ? Math.round(focus.progress_percentage) : 0;
  const latest = certs.find((c) => c.status !== "revoked" && isRenderedUrl(c.certificate_url));

  let status: React.ReactNode;
  if (eligibleCoursesWithoutCert.length > 0)
    status = <><strong>{eligibleCoursesWithoutCert.length} certificate{eligibleCoursesWithoutCert.length === 1 ? " is" : "s are"} ready</strong> for you to collect.</>;
  else if (focus && focus.progress_percentage < THRESHOLD)
    status = <><strong>{Math.ceil(THRESHOLD - focus.progress_percentage)}% to go</strong> for your next certificate, in {courseName(focus)}.</>;
  else if (earnedCount > 0)
    status = <>You have <strong>{earnedCount} certificate{earnedCount === 1 ? "" : "s"}</strong>. Great work!</>;
  else status = "Finish 80% of a course to earn your first certificate.";

  return (
    <div className="sd-page">
      <section className="sd-hero mc-band" aria-labelledby="cf-title">
        <div className="sd-hero-copy">
          <h1 id="cf-title" className="mc-hero-title">Certificates</h1>
          <p className="sd-status">{status}</p>
          <div className="sd-hero-actions">
            {eligibleCoursesWithoutCert[0] ? (
              <button
                className="sd-btn sd-btn--amber"
                disabled={generatingCertId === eligibleCoursesWithoutCert[0].id}
                onClick={() => handleRequestCertificate(eligibleCoursesWithoutCert[0].id)}
              >
                {generatingCertId === eligibleCoursesWithoutCert[0].id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Award aria-hidden="true" />}
                Get my certificate
              </button>
            ) : focus && focus.progress_percentage < THRESHOLD ? (
              <Link href={`/lms/student/my-courses/${focus.id}?resume=1`} className="sd-btn sd-btn--amber">Keep learning</Link>
            ) : latest ? (
              <button className="sd-btn sd-btn--amber" onClick={() => setPreviewCert({ id: latest.id, url: latest.certificate_url!, name: latest.certificate_name || "Certificate" })}>
                <Eye aria-hidden="true" />See my latest
              </button>
            ) : (
              <Link href="/lms/student/my-courses" className="sd-btn sd-btn--amber">Open my courses</Link>
            )}
          </div>
        </div>
        <div className="an-run">
          <ThresholdTrack value={focusPct} ticks={[{ at: THRESHOLD, label: "Certificate" }]} />
          <div className="sd-run-foot">
            <b>{focusPct}%<small>{focus ? courseName(focus) : "No course yet"}</small></b>
            <span>A certificate arrives at {THRESHOLD}%</span>
          </div>
        </div>
      </section>

      <div className="sd-ledger">
        <div><span className="sd-l">Earned</span><b className="sd-n">{earnedCount}</b><small>Certificates</small></div>
        <div><span className="sd-l">Ready</span><b className="sd-n">{eligibleCoursesWithoutCert.length}</b><small>Waiting to be collected</small></div>
        <div><span className="sd-l">On the way</span><b className="sd-n">{inProgressCourses.length}</b><small>Courses to finish</small></div>
        <div><span className="sd-l">Average grade</span><b className="sd-n">{avgGrade != null ? `${avgGrade}%` : "—"}</b><small>{avgGrade != null ? "Across graded courses" : "No grades yet"}</small></div>
      </div>

      <div className="mc-cols">
        <div className="mc-main">
          {eligibleCoursesWithoutCert.length > 0 && (
            <section className="sd-panel" aria-labelledby="cf-ready">
              <div className="sd-panel-head">
                <div>
                  <h2 id="cf-ready">Ready to collect</h2>
                  <p>Certificates arrive by themselves. If yours has not, press the button.</p>
                </div>
              </div>
              <div>
                {eligibleCoursesWithoutCert.map((course) => (
                  <div key={course.id} className="cf-row">
                    <div>
                      <h3>{courseName(course)}</h3>
                      <p>{[course.grade, course.subject].filter(Boolean).join(" • ")}</p>
                    </div>
                    <button className="sd-btn sd-btn--amber" onClick={() => handleRequestCertificate(course.id)} disabled={generatingCertId === course.id}>
                      {generatingCertId === course.id ? <><Loader2 className="animate-spin" aria-hidden="true" />Making it</> : <><Award aria-hidden="true" />Get certificate</>}
                    </button>
                    <div className="co-gate" style={{ "--t": `${THRESHOLD}%` } as React.CSSProperties}>
                      <div className="co-gate-tick" />
                      <div className="sd-meter"><i style={{ "--p": `${Math.min(100, course.progress_percentage)}%` } as React.CSSProperties} /></div>
                      <p className="co-gate-cap"><span>{course.progress_percentage.toFixed(0)}% done</span><span>Certificate at {THRESHOLD}%</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="cf-wall" style={{ display: "grid", gap: "0.75rem" }}>
            <h2 id="cf-wall" className="as-h2" style={{ margin: 0 }}>Your certificates</h2>
            {certificatesLoading ? (
              <div className="cf-grid"><div className="sd-skel" style={{ height: "18rem" }} /><div className="sd-skel" style={{ height: "18rem" }} /></div>
            ) : certs.length > 0 ? (
              <div className="cf-grid">
                {certs.map((cert) => {
                  const rendered = isRenderedUrl(cert.certificate_url);
                  const name = cert.certificate_name || "Certificate";
                  return (
                    <article key={cert.id} className="cf-card">
                      <div className="cf-frame">
                        {cert.status === "revoked" ? (
                          <Award aria-hidden="true" size={48} color="var(--sd-navy-line)" />
                        ) : rendered ? (
                          <button onClick={() => setPreviewCert({ id: cert.id, url: cert.certificate_url!, name })} aria-label={`View ${name} full size`}>
                            {/* eslint-disable-next-line @next/next/no-img-element -- external certificate URL, not static asset */}
                            <img src={cert.certificate_url} alt={name} loading="lazy" />
                          </button>
                        ) : (
                          <>
                            <div className="sd-skel" />
                            <p className="cf-wait">Being made. Check back in a moment.</p>
                          </>
                        )}
                      </div>
                      <div className="cf-body">
                        <h3>{name}</h3>
                        <p className="cf-meta">
                          <span>{cert.courses?.name || cert.courses?.title || "Course"}{cert.courses?.grade || cert.courses?.subject ? ` • ${[cert.courses?.grade, cert.courses?.subject].filter(Boolean).join(" • ")}` : ""}</span>
                          <span>Issued {new Date(cert.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} by {cert.issued_by || "YugMinds"}</span>
                        </p>
                        {cert.status === "revoked" ? (
                          <div className="ls-note" data-t="late" role="alert">
                            <b>This certificate was taken back</b>
                            {cert.revoked_reason && <p>Reason: {cert.revoked_reason}</p>}
                            <p>Talk to your school administrator if you think this is a mistake.</p>
                          </div>
                        ) : rendered ? (
                          <>
                            <div className="cf-acts">
                              <button className="sd-btn sd-btn--line" onClick={() => setPreviewCert({ id: cert.id, url: cert.certificate_url!, name })}>
                                <Eye aria-hidden="true" />View
                              </button>
                              <button className="sd-btn sd-btn--ink" onClick={() => handleDownload(cert.id, cert.certificate_name || "certificate")}>
                                <Download aria-hidden="true" />Download
                              </button>
                            </div>
                            {cert.short_id && (
                              <a href={getVerifyCertUrl(cert.short_id)} target="_blank" rel="noopener noreferrer" className="cf-verify">
                                <ExternalLink className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Check it is real
                              </a>
                            )}
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="sd-panel">
                <div className="sd-empty">
                  <b>No certificates yet</b>
                  <p>Finish 80% of a course and your certificate shows up here by itself.</p>
                  <Link href="/lms/student/my-courses" className="sd-btn sd-btn--amber">Open my courses</Link>
                </div>
              </section>
            )}
          </section>
        </div>

        <aside className="mc-aside">
          <section className="sd-panel" aria-labelledby="cf-next">
            <div className="sd-panel-head"><div><h2 id="cf-next">Finish these next</h2><p>Closest to a certificate first</p></div></div>
            {inProgressCourses.length > 0 ? (
              <div className="cf-side">
                {inProgressCourses.slice(0, 5).map((course) => (
                  <Link key={course.id} href={`/lms/student/my-courses/${course.id}?resume=1`} className="cf-link">
                    <div className="cf-row">
                      <div>
                        <h3>{courseName(course)}</h3>
                        <div className="co-gate" style={{ "--t": `${THRESHOLD}%` } as React.CSSProperties}>
                          <div className="co-gate-tick" />
                          <div className="sd-meter" style={{ marginTop: "0.45rem" }}><i style={{ "--p": `${Math.min(100, course.progress_percentage)}%` } as React.CSSProperties} /></div>
                        </div>
                        <p className="cf-togo"><b>{Math.ceil(THRESHOLD - course.progress_percentage)}%</b> to go</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              coursesList.length === 0 ? (
              <div className="sd-empty"><b>No courses yet</b><p>Courses your school assigns will show up here.</p></div>
            ) : (
              <div className="sd-empty"><b>Nothing waiting</b><p>All your courses are past 80%.</p></div>
            )
            )}
          </section>

          <div className="ls-note">
            {/* This is the only rule the backend checks: 80% of a course's chapters. */}
            <b>How you earn one</b>
            <p>Finish 80% of a course&apos;s chapters. Your certificate is made for you as soon as you pass that mark.</p>
          </div>
        </aside>
      </div>

      {previewCert && (
        <div className="cf-lb" onClick={() => setPreviewCert(null)}>
          <div className="cf-lb-card" role="dialog" aria-modal="true" aria-label={previewCert.name} onClick={(e) => e.stopPropagation()}>
            <div className="cf-lb-head">
              <b>{previewCert.name}</b>
              <div className="cf-lb-acts">
                <button className="sd-btn sd-btn--ink" style={{ minHeight: "2.4rem", padding: "0.3rem 1.1rem" }} onClick={() => handleDownload(previewCert.id, previewCert.name)}>
                  <Download aria-hidden="true" />Download
                </button>
                <button ref={closeRef} className="pl-ico" onClick={() => setPreviewCert(null)} aria-label="Close"><X /></button>
              </div>
            </div>
            <div className="cf-lb-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewCert.url} alt={previewCert.name} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
