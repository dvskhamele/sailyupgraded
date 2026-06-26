import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";

export default async function LocaleRootPage() {
  const session = await getSession();
  
  // If user is authenticated (type "user"), redirect to dashboard
  if (session?.type === "user") {
    redirect("/crm/dashboard");
  }

  return <LandingPage />;
}
