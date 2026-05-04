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
  emailOptions: EmailOptions
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
    return Promise.resolve(console.log(`Email sent to ${emailOptions.to}`));
  } catch (error: any | Error) {
    console.error(`Error occurred while sending email: ${error.message}`);
  }
}
