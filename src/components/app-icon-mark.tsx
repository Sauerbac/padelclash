/**
 * The app icon mark, rendered by satori (next/og ImageResponse) — not a DOM
 * component. Everything is proportional to `size` so the same mark serves
 * favicon-, manifest- and apple-icon sizes. Full-bleed background keeps the
 * maskable variant safe; the glyph stays inside the central 60 % safe zone.
 */
export function AppIconMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#16110d",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          color: "#f2e7d3",
          fontSize: size * 0.5,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        P
        <div
          style={{
            width: size * 0.14,
            height: size * 0.14,
            marginTop: size * 0.03,
            marginLeft: size * 0.02,
            borderRadius: "50%",
            background: "#e03616",
          }}
        />
      </div>
    </div>
  );
}
