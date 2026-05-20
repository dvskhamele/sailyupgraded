import nodemailer from "nodemailer";
import { getEmailFromAddress, getEnv } from "@/lib/env";

interface EmailOptions {
  from: string | undefined;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export default async function sendEmail(
  emailOptions: EmailOptions,
  options?: { throwOnError?: boolean }
): Promise<void> {
  const host = getEnv("EMAIL_HOST", "SMTP_HOST");
  const user = getEnv("EMAIL_USERNAME", "SMTP_USER");
  const pass = getEnv("EMAIL_PASSWORD", "SMTP_PASSWORD");

  const transporter = nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  try {
    await transporter.sendMail({
      ...emailOptions,
      from: emailOptions.from ?? getEmailFromAddress(),
    });
    console.log(`Email sent to ${emailOptions.to}`);
    return;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error occurred while sending email: ${message}`);
    if (options?.throwOnError) {
      throw error;
    }
  }
}
