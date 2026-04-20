import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/profile?tab=administration");
}
