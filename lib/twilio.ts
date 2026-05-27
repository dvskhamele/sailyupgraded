import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  console.warn("Twilio credentials are missing in environment variables.");
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;
export const twilioPhoneNumber = phoneNumber;
