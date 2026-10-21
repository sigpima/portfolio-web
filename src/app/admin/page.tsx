import { cookies } from "next/headers";
import LinksDashboard from "@/components/admin/LinksDashboard";
import LoginForm from "@/components/admin/LoginForm";
import { ADMIN_COOKIE } from "@/lib/server/cookies";

export const dynamic = "force-dynamic";

/**
 * `/admin`: the login form, or the dashboard when the `pf_admin` cookie exists (its validity is
 * checked by every API call; a 401 there switches back to the login form).
 */
export default async function AdminPage() {
  const store = await cookies();
  if (!store.get(ADMIN_COOKIE)?.value) return <LoginForm />;
  return <LinksDashboard siteUrl={process.env.SITE_URL ?? ""} />;
}
