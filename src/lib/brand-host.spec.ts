import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  brandFromHostname,
  canonicalUrl,
  getVerifyCertUrl,
  routeForHost,
  toPublicPath,
} from "./brand-host.ts";

const redirect = (url: string, status: 307 | 308 = 308) => ({ kind: "redirect", url, status });
const rewrite = (path: string) => ({ kind: "rewrite", path });
const pass = { kind: "pass" };

describe("brand-host", () => {
  it("maps hostnames to brands", () => {
    assert.equal(brandFromHostname("yugminds.org"), "yugminds");
    assert.equal(brandFromHostname("www.yugminds.org"), "yugminds");
    assert.equal(brandFromHostname("robocoders.yugminds.org"), "robocoders");
    assert.equal(brandFromHostname("lms.yugminds.org"), "lms");
    assert.equal(brandFromHostname("dev.yugminds.org"), null);
    assert.equal(brandFromHostname("localhost"), null);
  });

  it("leaves non-production hosts and assets alone", () => {
    assert.deepEqual(routeForHost(null, "/robocoders/about"), pass);
    assert.deepEqual(routeForHost("robocoders", "/api/health"), pass);
    assert.deepEqual(routeForHost("lms", "/sitemap.xml"), pass);
  });

  it("yugminds.org sends brand paths to their subdomains", () => {
    assert.deepEqual(routeForHost("yugminds", "/"), pass);
    assert.deepEqual(
      routeForHost("yugminds", "/robocoders"),
      redirect("https://robocoders.yugminds.org/"),
    );
    assert.deepEqual(
      routeForHost("yugminds", "/robocoders/programs"),
      redirect("https://robocoders.yugminds.org/programs"),
    );
    assert.deepEqual(
      routeForHost("yugminds", "/lms/login"),
      redirect("https://lms.yugminds.org/lms/login"),
    );
  });

  it("robocoders host serves clean URLs", () => {
    assert.deepEqual(routeForHost("robocoders", "/"), rewrite("/robocoders"));
    assert.deepEqual(routeForHost("robocoders", "/about"), rewrite("/robocoders/about"));
    assert.deepEqual(
      routeForHost("robocoders", "/robocoders/about"),
      redirect("https://robocoders.yugminds.org/about"),
    );
    assert.deepEqual(
      routeForHost("robocoders", "/lms/login"),
      redirect("https://lms.yugminds.org/lms/login"),
    );
  });

  it("lms host keeps the /lms prefix", () => {
    assert.deepEqual(
      routeForHost("lms", "/"),
      redirect("https://lms.yugminds.org/lms/login", 307),
    );
    assert.deepEqual(routeForHost("lms", "/lms/admin/analytics"), pass);
    assert.deepEqual(
      routeForHost("lms", "/login"),
      redirect("https://lms.yugminds.org/lms/login"),
    );
    assert.deepEqual(
      routeForHost("lms", "/robocoders/about"),
      redirect("https://robocoders.yugminds.org/about"),
    );
  });

  it("verify has one canonical URL", () => {
    const canonical = "https://robocoders.yugminds.org/lms/verify/abc";
    assert.deepEqual(
      routeForHost("robocoders", "/lms/verify/abc"),
      rewrite("/robocoders/lms/verify/abc"),
    );
    assert.deepEqual(routeForHost("robocoders", "/robocoders/lms/verify/abc"), redirect(canonical));
    assert.deepEqual(routeForHost("lms", "/lms/verify/abc"), redirect(canonical));
    assert.deepEqual(routeForHost("yugminds", "/robocoders/lms/verify/abc"), redirect(canonical));
    assert.equal(getVerifyCertUrl("abc"), canonical);
  });

  it("builds canonical URLs", () => {
    assert.equal(toPublicPath("robocoders", "/robocoders/about"), "/about");
    assert.equal(toPublicPath("lms", "/lms/login"), "/lms/login");
    assert.equal(
      canonicalUrl("robocoders", "/robocoders"),
      "https://robocoders.yugminds.org",
    );
    assert.equal(
      canonicalUrl("lms", "/lms/login"),
      "https://lms.yugminds.org/lms/login",
    );
  });
});
