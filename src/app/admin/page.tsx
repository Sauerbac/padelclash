import { AdminView } from "@/components/admin-view";
import { isAdmin } from "@/services/auth/admin";
import { getDb } from "@/services/db";
import { getGeneralLink } from "@/services/onboarding";
import { getAdminRoster } from "@/services/players";

export const metadata = { title: "Admin · PadelClash" };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminView state="login" />;
  }

  const db = getDb();
  const now = new Date();
  const [roster, generalLink] = await Promise.all([
    getAdminRoster(db, now),
    getGeneralLink(db),
  ]);

  return (
    <AdminView
      state="panel"
      roster={roster}
      generalLink={generalLink}
      now={now}
    />
  );
}
