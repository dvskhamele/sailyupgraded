import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { EmailLink } from "@/components/ui/contact-link";
import { redirect } from "next/navigation";
import TryAgain from "./components/TryAgain";
import { Users } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const InactivePage = async () => {
  const adminUsers: Users[] = await prismadb.users.findMany({
    where: {
      role: "admin",
      userStatus: "ACTIVE",
    },
  });

  const session = await getSession();

  if (session?.user.userStatus !== "INACTIVE") {
    return redirect("/");
  }

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-white/80 dark:bg-card/80 backdrop-blur shadow-xl">
      <CardHeader className="space-y-4 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-xs">
            <Image
              src="/logo/saily-icon.png"
              alt="Saily"
              width={64}
              height={64}
              className="h-full w-full object-contain p-1"
              priority
            />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">
            Saily
          </span>
        </div>

        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">
            Account Deactivated
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Hi, your Saily account has been disabled. Ask an administrator in your organization to activate your account.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <h2 className="flex justify-center text-base font-semibold mb-2">Administrators</h2>
        <div className="flex flex-col gap-2">
          {adminUsers &&
            adminUsers?.map((user: Users) => (
              <div
                key={user.id}
                className="flex flex-col p-3 border rounded-lg bg-muted/40"
              >
                <div>
                  <p className="font-semibold text-sm">{user.name}</p>
                  <p className="text-xs text-muted-foreground"><EmailLink value={user.email} /></p>
                </div>
              </div>
            ))}
        </div>

        <div className="flex flex-col md:flex-row space-x-2 justify-center items-center pt-5">
          <Button asChild variant="outline">
            <Link href="/sign-in">Log-in with another account</Link>
          </Button>
          <p className="text-xs text-muted-foreground">or</p>
          <TryAgain />
        </div>
      </CardContent>
    </Card>
  );
};

export default InactivePage;
