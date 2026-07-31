"use client";

import type { VariantProps } from "class-variance-authority";
import { Case, GalleryPage, Section } from "../chrome";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  alertVariants,
} from "@/components/ui/alert";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Every primitive in `src/components/ui/`, in every variant it declares.
 *
 * The variant maps are typed `Record<Union, …>` on purpose (decision 128):
 * adding a variant to a CVA config fails `tsc` here until it is catalogued.
 * That is the only mechanical completeness check in the catalogue — do not
 * relax these to `Partial<>` or an array to get a build green.
 */

type ButtonVariant = NonNullable<
  VariantProps<typeof buttonVariants>["variant"]
>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

/** What each button variant is for, so a reviewer can spot a misuse. */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: "primary CTA — Anton on red",
  outline: "secondary action — gold on a hairline",
  secondary: "neutral action on the card tone",
  ghost: "low-emphasis / icon actions",
  destructive: "delete & discard — outlined, never filled",
  chip: "mono toggle chip (set counts, sides)",
  link: "inline navigation inside prose",
};

/** Icon sizes are shown with an icon; text sizes with a word. */
const BUTTON_SIZES: Record<ButtonSize, { label: string; icon: boolean }> = {
  default: { label: "Log match", icon: false },
  xs: { label: "Undo", icon: false },
  sm: { label: "Add set", icon: false },
  lg: { label: "Log match", icon: false },
  icon: { label: "icon", icon: true },
  "icon-xs": { label: "icon-xs", icon: true },
  "icon-sm": { label: "icon-sm", icon: true },
  "icon-lg": { label: "icon-lg", icon: true },
};

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: "Live",
  you: "You",
  pending: "Pending sync",
  blocked: "Can't sync",
  retired: "Retired",
  win: "Simon +187",
  loss: "Bartholomew −187",
  outline: "3 sets",
};

const ALERT_VARIANTS: Record<
  AlertVariant,
  { title: string; description: string }
> = {
  default: {
    title: "Heads up",
    description: "This device is bound. New matches are credited to you.",
  },
  destructive: {
    title: "Couldn't log that",
    description: "A match needs exactly one winning side.",
  },
};

/** Every colour token in `globals.css`, so a drifted value is visible. */
const TOKENS = [
  "background",
  "foreground",
  "card",
  "popover",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-border",
  "win",
  "podium-bronze",
  "hairline",
  "plate",
  "border",
  "input",
  "ring",
  "chart-1",
] as const;

// The classes the primitives apply on :focus-visible, pinned on so the ring is
// reviewable in a screenshot. Tabbing through the real controls is still the
// only check that they are wired to the right selector.
const FOCUS_RING = "border-ring ring-[3px] ring-ring/50";

function Dot() {
  return <span aria-hidden>●</span>;
}

export default function DesignSystemGallery() {
  return (
    <GalleryPage
      title="Design system"
      intro="Every primitive in src/components/ui/, across its variants, sizes and interaction states, plus the raw colour tokens. Cases are inline: none of these own the viewport, so none of them need an iframe."
      docs="docs/ui/README.md"
    >
      <Section
        id="tokens"
        title="Colour tokens"
        note="Single dark theme — globals.css declares :root only, with no .dark block and no prefers-color-scheme, so there is no theme axis to multiply any of this by."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          {TOKENS.map((token) => (
            <div key={token} style={{ border: "1px solid #2c2318" }}>
              <div
                style={{
                  height: 44,
                  background: `var(--${token})`,
                  borderBottom: "1px solid #2c2318",
                }}
              />
              <p style={{ fontSize: 10, margin: 0, padding: "4px 6px" }}>
                --{token}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="button"
        title="Button"
        note="Variants down, states across. Sizes get their own case because they are an independent axis — the full cross product would be 56 buttons that all say the same thing."
      >
        {Object.entries(BUTTON_VARIANTS).map(([variant, purpose]) => (
          <Case
            key={variant}
            id={`button-${variant}`}
            title={`variant="${variant}"`}
            note={purpose}
          >
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant={variant as ButtonVariant}>Rest</Button>
              <Button variant={variant as ButtonVariant} className={FOCUS_RING}>
                Focus
              </Button>
              <Button variant={variant as ButtonVariant} disabled>
                Disabled
              </Button>
              <Button variant={variant as ButtonVariant} aria-invalid>
                Invalid
              </Button>
              <Button variant={variant as ButtonVariant}>
                <Dot /> With icon
              </Button>
            </div>
          </Case>
        ))}

        <Case id="button-sizes" title="sizes" note="default variant, every size">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(BUTTON_SIZES).map(([size, { label, icon }]) => (
              <Button key={size} size={size as ButtonSize} aria-label={label}>
                {icon ? <Dot /> : label}
              </Button>
            ))}
          </div>
        </Case>
      </Section>

      <Section
        id="badge"
        title="Badge"
        note="Fixture text is deliberately abusive: a three-digit delta and a name long enough to wrap are what break these chips in the feed."
      >
        <Case id="badge-variants" title="every variant">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {Object.entries(BADGE_VARIANTS).map(([variant, label]) => (
              <Badge key={variant} variant={variant as BadgeVariant}>
                {label}
              </Badge>
            ))}
          </div>
        </Case>
        <Case
          id="badge-narrow"
          title="win/loss chips in a 288px column"
          note="the content width at the 320px viewport"
          width={288}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge variant="win">Bartholomew Fitzgerald-Huang +187</Badge>
            <Badge variant="loss">Anastasia Vandenberghe −187</Badge>
          </div>
        </Case>
      </Section>

      <Section id="alert" title="Alert">
        {(Object.entries(ALERT_VARIANTS) as [
          AlertVariant,
          (typeof ALERT_VARIANTS)[AlertVariant],
        ][]).map(([variant, copy]) => (
          <Case
            key={variant}
            id={`alert-${variant}`}
            title={`variant="${variant}"`}
          >
            <Alert variant={variant}>
              <AlertTitle>{copy.title}</AlertTitle>
              <AlertDescription>{copy.description}</AlertDescription>
            </Alert>
          </Case>
        ))}
        <Case id="alert-bare" title="no title — the inline-error shape">
          <Alert variant="destructive">
            That invitation link has already been used.
          </Alert>
        </Case>
      </Section>

      <Section
        id="input"
        title="Input & Label"
        note="Input has no border by design — the card-tone fill is the affordance. Check that the invalid state is still legible without one."
      >
        <Case id="input-states" title="rest / value / focus / disabled / invalid" width={360}>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <Label htmlFor="ds-rest">Guest name</Label>
              <Input id="ds-rest" placeholder="Who played?" />
            </div>
            <div>
              <Label htmlFor="ds-value">With a value</Label>
              <Input id="ds-value" defaultValue="Bartholomew Fitzgerald-Huang" />
            </div>
            <div>
              <Label htmlFor="ds-focus">Focus ring (pinned on)</Label>
              <Input id="ds-focus" defaultValue="Focused" className={FOCUS_RING} />
            </div>
            <div>
              <Label htmlFor="ds-disabled">Disabled</Label>
              <Input id="ds-disabled" defaultValue="Locked" disabled />
            </div>
            <div>
              <Label htmlFor="ds-invalid">Invalid</Label>
              <Input id="ds-invalid" defaultValue="" aria-invalid />
            </div>
            <div className="group" data-disabled="true">
              <Label htmlFor="ds-group">Label in a disabled group</Label>
              <Input id="ds-group" disabled />
            </div>
          </div>
        </Case>
      </Section>

      <Section
        id="select"
        title="Select"
        note="Open one: the popover renders in a portal on --popover, which is a different tone from the page and only shows its true colour here."
      >
        <Case id="select-states" title="rest / value / disabled / invalid" width={360}>
          <div style={{ display: "grid", gap: 12 }}>
            <Select>
              <SelectTrigger aria-label="Placeholder">
                <SelectValue placeholder="Pick a player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Simon</SelectItem>
                <SelectItem value="b">Bartholomew Fitzgerald-Huang</SelectItem>
                <SelectItem value="c">Casey</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="b">
              <SelectTrigger aria-label="With a value">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Simon</SelectItem>
                <SelectItem value="b">Bartholomew Fitzgerald-Huang</SelectItem>
              </SelectContent>
            </Select>
            <Select disabled>
              <SelectTrigger aria-label="Disabled">
                <SelectValue placeholder="Disabled" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Simon</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger aria-label="Invalid" aria-invalid>
                <SelectValue placeholder="Pick a player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Simon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Case>
        <Case
          id="searchable-select"
          title="searchable participant picker"
          note="Open it to inspect the pinned search field, locally scrolling roster, viewport collision handling and ellipsis on long names."
          width={288}
        >
          <SearchableSelect
            value=""
            onValueChange={() => {}}
            label="Participant"
            placeholder="Pick a participant"
            searchPlaceholder="Search players…"
            emptyText="No players found."
            options={[
              "Alexandria Catherine Beaumont",
              "Bartholomew Fitzgerald-Huang",
              "Casey",
              "Ingrid",
              "Maximilian Alexander von Rosenberg",
              "Christopher-Lee Montgomery-Smythe",
              "Amara",
              "Diego",
              "Elena",
              "Farid",
              "Giulia",
              "Hugo",
            ].map((label, index) => ({
              value: `player-${index}`,
              label,
            }))}
          />
        </Case>
      </Section>

      <Section id="switch" title="Switch">
        <Case id="switch-states" title="on / off × enabled / disabled">
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Switch defaultChecked aria-label="On" />
            <Switch aria-label="Off" />
            <Switch defaultChecked disabled aria-label="On, disabled" />
            <Switch disabled aria-label="Off, disabled" />
            <Switch aria-label="Focus" className={FOCUS_RING} />
          </div>
        </Case>
      </Section>

      <Section
        id="table"
        title="Table"
        note="The leaderboard shape. Long names are the interesting case: the table scrolls horizontally inside its own wrapper, which is allowed — page-level horizontal scroll is not (decision 88)."
      >
        <Case id="table-full" title="header / body / footer / caption" width={360}>
          <Table>
            <TableCaption>Ranked after three competitive matches.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>W–L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>1</TableCell>
                <TableCell>Bartholomew Fitzgerald-Huang</TableCell>
                <TableCell>1487</TableCell>
                <TableCell>12–3</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>2</TableCell>
                <TableCell>Simon</TableCell>
                <TableCell>1312</TableCell>
                <TableCell>9–7</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>—</TableCell>
                <TableCell>Casey</TableCell>
                <TableCell>1000</TableCell>
                <TableCell>1–1</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>3 players</TableCell>
                <TableCell />
                <TableCell />
                <TableCell>22–11</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Case>
      </Section>

      <Section
        id="alert-dialog"
        title="AlertDialog"
        note="Shown through ConfirmDialog, which is the only way the app uses it — one destructive-confirmation pattern, so the primitive is never assembled by hand."
      >
        <Case id="alert-dialog-confirm" title="the confirm pattern">
          <ConfirmDialog
            trigger={<Button variant="destructive">Delete match</Button>}
            title="Delete this match?"
            description="Ratings will be recomputed as if it never happened. History is watching."
            confirmLabel="Delete"
            onConfirm={() => {}}
          />
        </Case>
        <Case
          id="alert-dialog-long"
          title="a description long enough to wrap"
          note="the discard copy, which names the owner"
        >
          <ConfirmDialog
            trigger={<Button variant="destructive">Discard</Button>}
            title="Discard this queued match?"
            description="It never reached the server and can't be sent from this device any more. Discarding removes Bartholomew Fitzgerald-Huang's match for good — if it still matters, have them log it again from theirs."
            confirmLabel="Discard"
            onConfirm={() => {}}
          />
        </Case>
      </Section>
    </GalleryPage>
  );
}
