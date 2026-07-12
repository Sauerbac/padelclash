"use client";

import { useTransition } from "react";
import { setNamePickerAction } from "@/app/actions/admin";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function NamePickerToggle({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="name-picker">Name picker</Label>
        <p className="text-sm text-muted-foreground">
          Lets anyone opening the app on an unbound device pick their name
          from the roster. Handy for onboarding evenings; leave off otherwise.
        </p>
      </div>
      <Switch
        id="name-picker"
        checked={enabled}
        disabled={pending}
        onCheckedChange={(checked) =>
          startTransition(() => setNamePickerAction(checked))
        }
      />
    </div>
  );
}
