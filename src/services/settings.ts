import { eq } from "drizzle-orm";
import type { Db } from "./db";
import {
  SETTINGS_SINGLETON_ID,
  settings,
  type Settings,
} from "./db/schema";

// Single-row settings; absence of the row means "all defaults".

const defaults: Settings = {
  id: SETTINGS_SINGLETON_ID,
  namePickerEnabled: false,
};

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, SETTINGS_SINGLETON_ID));
  return row ?? defaults;
}

export async function setNamePickerEnabled(
  db: Db,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(settings)
    .values({ id: SETTINGS_SINGLETON_ID, namePickerEnabled: enabled })
    .onConflictDoUpdate({
      target: settings.id,
      set: { namePickerEnabled: enabled },
    });
}
