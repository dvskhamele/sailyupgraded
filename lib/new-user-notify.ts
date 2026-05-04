import { Users } from "@prisma/client";

import { prismadb } from "./prisma";
import { getEmailFromAddress } from "./env";
import sendEmail from "./sendmail";

export async function newUserNotify(newUser: Users) {
  const admins = await prismadb.users.findMany({
    where: {
      role: "admin",
    },
  });

  admins.forEach(async (admin) => {
    await sendEmail({
      from: getEmailFromAddress(),
      to: admin.email,
      subject: `New User Registration with PENDING state`,
      text: `New User Registered: ${newUser.name} \n\n Please login to ${process.env.NEXT_PUBLIC_APP_URL}/admin/users and activate them. \n\n Thank you \n\n ${process.env.NEXT_PUBLIC_APP_NAME}`,
    });

    console.log("Email sent to admin");
  });
}
