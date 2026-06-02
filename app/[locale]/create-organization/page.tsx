import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";

import { createOrganization } from "@/actions/organizations/create-organization";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession } from "@/lib/auth-server";

export default async function CreateOrganizationPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.userStatus === "PENDING") {
    redirect("/pending");
  }

  if (session.user.userStatus === "INACTIVE") {
    redirect("/inactive");
  }

  if (session.user.organizationId) {
    redirect("/crm/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>
            Set up your organization to continue to the CRM dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme Inc."
                required
                minLength={2}
                autoComplete="organization"
              />
            </div>
            <Button type="submit" className="w-full">
              Create Organization
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
