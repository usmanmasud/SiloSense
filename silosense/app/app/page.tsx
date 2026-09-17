import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AppIndexPage() {
  const user = await getCurrentUser();
  redirect(user ? "/app/repositories" : "/app/login");
}
