import { Resend } from "resend";
import { prismadb } from "./prisma";
import { getResendApiKey } from "./env";

export default async function resendHelper() {
  const resendKey = await prismadb.systemServices.findFirst({
    where: {
      name: "resend_smtp",
    },
  });

  const apiKey = getResendApiKey() || resendKey?.serviceKey;

  // For development with dummy key, return null to trigger fallback
  if (!apiKey || (process.env.NODE_ENV !== "production" && apiKey === "dummy-key-for-development")) {
    return null;
  }

  const resend = new Resend(apiKey);

  return resend;
}
