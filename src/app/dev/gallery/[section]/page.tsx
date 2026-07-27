import { notFound } from "next/navigation";
import { Frames, GalleryPage, Section } from "../chrome";
import {
  isMainGallerySection,
  SCREEN_GALLERIES,
  screenCaseHref,
} from "../screen-cases";

export default async function MainScreenGalleryPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isMainGallerySection(section)) notFound();
  const gallery = SCREEN_GALLERIES[section];

  return (
    <GalleryPage
      title={gallery.title}
      intro={gallery.intro}
      docs={gallery.docs}
    >
      <Section id="screens" title="Screen states">
        {Object.entries(gallery.cases).map(([id, screenCase]) => (
          <Frames
            key={id}
            id={id}
            title={screenCase.title}
            note={screenCase.note}
            href={screenCaseHref(section, id)}
          />
        ))}
      </Section>
    </GalleryPage>
  );
}
