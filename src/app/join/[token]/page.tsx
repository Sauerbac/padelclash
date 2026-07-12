import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>This link doesn&apos;t work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The invite link is invalid or has been replaced. Ask the group
            admin for a fresh one.
          </CardContent>
        </Card>
      </main>
    );
  }

  return <JoinLanding token={token} playerName={player.name} />;
}
