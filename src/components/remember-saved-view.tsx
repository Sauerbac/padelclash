"use client";

import { useEffect } from "react";
import {
  saveSavedView,
  saveViewerScope,
  type SavedViewKind,
} from "@/services/offline/saved-views";

export function RememberSavedView({
  kind,
  bindingPlayerId,
  projection,
}: {
  kind: SavedViewKind;
  bindingPlayerId: string;
  projection: unknown;
}) {
  useEffect(() => {
    void saveViewerScope({ kind: "player", playerId: bindingPlayerId })
      .then(() => saveSavedView(kind, bindingPlayerId, projection))
      .catch(() => undefined);
  }, [bindingPlayerId, kind, projection]);
  return null;
}

export function RememberViewerScope({
  bindingPlayerId,
}: {
  bindingPlayerId: string | null;
}) {
  useEffect(() => {
    void saveViewerScope(
      bindingPlayerId
        ? { kind: "player", playerId: bindingPlayerId }
        : { kind: "admin-unbound" },
    ).catch(() => undefined);
  }, [bindingPlayerId]);
  return null;
}
