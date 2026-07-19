"use client";

import { useTransition } from "react";
import { setNamePickerAction } from "@/app/actions/admin";
import { Switch } from "@/components/ui/switch";

export function NamePickerToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="name-picker"
          className="text-[17px] font-semibold uppercase"
        >
          Name picker
        </label>
        <Switch
          id="name-picker"
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) =>
            startTransition(() => setNamePickerAction(checked))
          }
        />
      </div>
      <p className="mt-1.5 text-sm leading-snug font-semibold text-muted-foreground">
        When on, unbound devices can pick a roster name to bind themselves.
        Handy for onboarding night. Otherwise leave it off.
      </p>
    </div>
  );
}
