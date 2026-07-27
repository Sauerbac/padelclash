import { Frames, GalleryPage, Section } from "../chrome";
import { FEED_CASES, feedCaseHref } from "./cases";

/**
 * The Feed section: every state in `docs/ui/feed.md`, each in an iframe at the
 * three supported phone widths. The iframes are not decoration — the tab bar is
 * anchored to the viewport (decision 86) and page-level horizontal scroll is a
 * defect (decision 88), and inline down this scrolling page both would report
 * falsely.
 */
export default function FeedGallery() {
  return (
    <GalleryPage
      title="Feed"
      intro="The home screen at 320, 390 and 430 px. Scroll inside a frame to check the tab bar stays put; drag horizontally to confirm nothing overflows."
      docs="docs/ui/feed.md"
    >
      <Section
        id="screens"
        title="Screen states"
        note="Fixtures are abusive on purpose: names that wrap at 320, three-digit deltas, five sets, guests on both sides."
      >
        {Object.entries(FEED_CASES).map(([id, feedCase]) => (
          <Frames
            key={id}
            id={id}
            title={feedCase.title}
            note={feedCase.note}
            href={feedCaseHref(id)}
          />
        ))}
      </Section>

      <Section
        id="interaction"
        title="Interaction checks"
        note="Focus-visible rings remain real interaction states: tab inside a frame. The design-system section also pins the ring classes on for static inspection."
      >
        <p style={{ fontSize: 12, color: "#8f7d63", margin: 0 }}>
          The installed-PWA invitation entry is pinned by its own fixture case;
          no browser display-mode detection or live device queue is consulted.
        </p>
      </Section>
    </GalleryPage>
  );
}
