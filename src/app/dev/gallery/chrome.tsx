import Link from "next/link";
import { GALLERY_SECTIONS } from "./registry";

/**
 * The gallery's own furniture. Deliberately plain HTML with inline styles and
 * not one import from `src/components/ui/`: a broken `Button` must not break
 * the tool you use to look at the broken `Button`. It also keeps the chrome
 * visually unmistakable from the app it frames, so nobody reviews a heading and
 * thinks they are reviewing the product.
 */

const ink = "#f2e7d3";
const dim = "#8f7d63";
const rule = "#2c2318";
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function GalleryPage({
  title,
  intro,
  docs,
  children,
}: {
  title: string;
  intro: string;
  /**
   * The repo path of the prose this section catalogues. Rendered as text, not
   * a link: Markdown in `docs/` is not served by the app, and a link that 404s
   * would be worse than a path a reviewer can open in their editor.
   */
  docs?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: mono,
        color: ink,
        padding: "24px 20px 96px",
        // `width` is not redundant next to `maxWidth`: this is a flex item of
        // the root layout's column scroller, where `margin: auto` on the cross
        // axis cancels `stretch` and leaves the page shrink-to-fit — narrow
        // sections would then centre at a different width from wide ones.
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <p style={{ fontSize: 12, color: dim, margin: 0 }}>
        <Link href="/dev/gallery" style={{ color: dim }}>
          /dev/gallery
        </Link>
        {" · dev only · fixtures, never the database"}
      </p>
      <nav
        aria-label="Gallery sections"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 12,
        }}
      >
        {GALLERY_SECTIONS.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            style={{
              border: `1px solid ${rule}`,
              color: "#d9a441",
              fontSize: 11,
              padding: "4px 7px",
              textDecoration: "none",
            }}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <h1 style={{ fontSize: 22, margin: "10px 0 6px", fontWeight: 700 }}>
        {title}
      </h1>
      <p style={{ fontSize: 13, color: dim, margin: 0, maxWidth: "68ch" }}>
        {intro}
      </p>
      {docs && (
        <p style={{ fontSize: 13, margin: "8px 0 0", color: "#d9a441" }}>
          Documented in {docs}
        </p>
      )}
      <hr style={{ border: 0, borderTop: `1px solid ${rule}`, margin: "20px 0 0" }} />
      {children}
    </div>
  );
}

/** A named group of cases. `id` is the anchor other docs link to. */
export function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginTop: 36, scrollMarginTop: 16 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px", fontWeight: 700 }}>
        <a href={`#${id}`} style={{ color: dim, textDecoration: "none" }}>
          #{" "}
        </a>
        {title}
      </h2>
      {note && (
        <p style={{ fontSize: 12, color: dim, margin: "0 0 12px", maxWidth: "80ch" }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * One case rendered inline. For component-level states only — screens go in
 * `Frames`, because the tab bar is anchored to the viewport (decision 86) and
 * horizontal overflow is a defect (decision 88); inline, neither reports
 * truthfully.
 */
export function Case({
  id,
  title,
  note,
  width,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  /** Constrain to a phone-ish column when the case is layout-sensitive. */
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div id={id} style={{ margin: "0 0 20px", scrollMarginTop: 16 }}>
      <p style={{ fontSize: 11, color: dim, margin: "0 0 6px" }}>
        <a href={`#${id}`} style={{ color: dim, textDecoration: "none" }}>
          {id}
        </a>
        {" — "}
        {title}
        {note ? ` · ${note}` : ""}
      </p>
      <div
        style={{
          border: `1px dashed ${rule}`,
          padding: 12,
          maxWidth: width ?? undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The supported phone widths, with each device's real height so the iframe
 * reports the tab bar's anchoring and the page's overflow the way the phone
 * would. 320 is the floor the layout has to survive; 430 the ceiling.
 */
const VIEWPORTS = [
  { width: 320, height: 568, label: "320 · iPhone SE" },
  { width: 390, height: 844, label: "390 · iPhone 14" },
  { width: 430, height: 932, label: "430 · iPhone 14 Pro Max" },
] as const;

/** One screen case, in a fixed-width iframe per supported phone width. */
export function Frames({
  id,
  title,
  note,
  href,
}: {
  id: string;
  title: string;
  note?: string;
  /** The case route rendering this state on its own. */
  href: string;
}) {
  return (
    <div id={id} style={{ margin: "0 0 32px", scrollMarginTop: 16 }}>
      <p style={{ fontSize: 12, margin: "0 0 2px" }}>
        <a href={`#${id}`} style={{ color: dim, textDecoration: "none" }}>
          {id}
        </a>
        {" — "}
        <strong style={{ fontWeight: 700 }}>{title}</strong>{" "}
        <a href={href} style={{ color: "#d9a441", fontSize: 11 }}>
          open ↗
        </a>
      </p>
      {note && (
        <p style={{ fontSize: 12, color: dim, margin: "0 0 8px", maxWidth: "80ch" }}>
          {note}
        </p>
      )}
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8 }}>
        {VIEWPORTS.map((viewport) => (
          <div key={viewport.width} style={{ flex: "0 0 auto" }}>
            <p style={{ fontSize: 10, color: dim, margin: "0 0 4px" }}>
              {viewport.label}
            </p>
            <iframe
              src={href}
              title={`${title} at ${viewport.width}px`}
              width={viewport.width}
              height={viewport.height}
              style={{ border: `1px solid ${rule}`, display: "block" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
