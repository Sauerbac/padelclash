import { JoinLanding } from "@/components/join-landing";
import { getDb } from "@/services/db";
import { getPlayerByToken } from "@/services/players";

export const metadata = { title: "Join · PadelClash" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const player = await getPlayerByToken(getDb(), token);

  if (!player) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm border px-5 py-6">
          <h1 className="font-display text-3xl leading-[1.1] uppercase">
            This link doesn&apos;t work
          </h1>
          <p className="mt-3 text-base leading-normal font-semibold text-muted-foreground">
            The invite link is invalid or has been replaced. Ask the group
            admin for a fresh one.
          </p>
        </div>
      </main>
    );
  }

  return <JoinLanding token={token} playerName={player.name} />;
}
