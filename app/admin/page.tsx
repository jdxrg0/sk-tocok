import { redirect } from "next/navigation";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import AdminDashboardClient from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isOfficialUser(user)) {
    redirect("/");
  }

  return <AdminDashboardClient />;
}
