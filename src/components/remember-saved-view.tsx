"use client";

import { useEffect } from "react";
import {
  recordSavedView,
  saveViewerScope,
  type SavedViewKind,
} from "@/services/offline/saved-views";

export function RememberSavedView({
  kind,
  bindingId,
  playerId,
  projection,
}: {
  kind: SavedViewKind;
  bindingId: string;
  playerId: string;
  projection: Parameters<typeof recordSavedView>[2];
}) {
  useEffect(() => {
    void recordSavedView(kind, { kind: "player", playerId, bindingId }, projection).catch(() => undefined);
  }, [bindingId, kind, playerId, projection]);
  return null;
}

export function RememberViewerScope({
  bindingId,
  playerId,
}: {
  bindingId: string | null;
  playerId?: string;
}) {
  useEffect(() => {
    void saveViewerScope(
      bindingId && playerId
        ? { kind: "player", playerId, bindingId }
        : { kind: "admin-unbound" },
    ).catch(() => undefined);
  }, [bindingId, playerId]);
  return null;
}
