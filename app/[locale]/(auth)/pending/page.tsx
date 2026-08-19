import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { EmailLink } from "@/components/ui/contact-link";
import { redirect } from "next/navigation";
import TryAgain from "./components/TryAgain";
import { Users } from "@prisma/client";

const PendingPage = async () => {
  const session = await getSession();
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const seededTestUserEmail = (
    process.env.TEST_USER_EMAIL || "test@nextcrm.app"
  ).trim().toLowerCase();

  if (session?.user.userStatus !== "PENDING") {
    return redirect("/");
  }

  const adminUsers: Users[] = await prismadb.users.findMany({
    where: {
      role: "admin",
      userStatus: "ACTIVE",
    },
  });

  const usersCount = await prismadb.users.count();
  const nonSeedUsersCount = await prismadb.users.count({
    where: {
      email: {
        not: seededTestUserEmail,
      },
    },
  });
  const normalizedSessionEmail = session?.user.email?.trim().toLowerCase();
  const shouldActivateConfiguredAdmin =
    Boolean(configuredAdminEmail) &&
    normalizedSessionEmail === configuredAdminEmail;
  const shouldActivateFirstRealUser =
    normalizedSessionEmail !== seededTestUserEmail && nonSeedUsersCount === 1;

  if (
    session?.user.id &&
    ((adminUsers.length === 0 && usersCount === 1) ||
      shouldActivateConfiguredAdmin ||
      shouldActivateFirstRealUser)
  ) {
    await prismadb.users.update({
      where: { id: session.user.id },
      data: {
        role: "admin",
        userStatus: "ACTIVE",
        is_admin: true,
        is_account_admin: true,
      },
    });
    return redirect("/");
  }

  return (
    <div className="flex flex-col space-y-5 justify-center items-center max-w-3xl border rounded-2xl p-10 shadow-md bg-white/80 dark:bg-card/80 backdrop-blur">
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
          SailySaaS
        </span>
      </div>

      <div className="flex flex-col text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Your account is pending Admin approval
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Welcome to Saily. Ask an administrator in your organization to approve your account.
        </p>
      </div>
      <div className="flex flex-col justify-center w-full">
        <h2 className="flex justify-center text-base font-semibold mb-2">Administrators</h2>
        {adminUsers &&
          adminUsers?.map((user: Users) => (
            <div
              key={user.id}
              className="flex flex-col p-4 m-2 gap-1 border rounded-lg bg-muted/40"
            >
              <div>
                <p className="font-semibold text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground"><EmailLink value={user.email} /></p>
              </div>
            </div>
          ))}
      </div>
      <div className="flex flex-col md:flex-row space-x-2 justify-center items-center pt-2">
        <Button asChild variant="outline">
          <Link href="/sign-in">Log-in with another account</Link>
        </Button>
        <p className="text-xs text-muted-foreground">or</p>
        <TryAgain />
      </div>
    </div>
  );
};

export default PendingPage;
