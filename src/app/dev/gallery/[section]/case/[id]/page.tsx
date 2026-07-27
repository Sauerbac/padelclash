import { notFound } from "next/navigation";
import {
  isMainGallerySection,
  SCREEN_GALLERIES,
} from "../../../screen-cases";

export default async function MainScreenCasePage({
  params,
}: {
  params: Promise<{ section: string; id: string }>;
}) {
  const { section, id } = await params;
  if (!isMainGallerySection(section)) notFound();
  const screenCase = SCREEN_GALLERIES[section].cases[id];
  if (!screenCase) notFound();
  return screenCase.render();
}
