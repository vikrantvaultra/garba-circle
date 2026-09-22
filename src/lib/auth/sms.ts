/**
 * OTP delivery. No SMS provider has a free tier, so the default transport
 * prints the code to the server log and returns it to the client in dev —
 * the app is fully usable before any provider is paid for.
 *
 * Set SMS_PROVIDER=msg91 or twilio plus the matching keys to go live.
 */

import { devOtpAllowed } from "@/lib/env";

export type SmsResult = { delivered: boolean; devCode?: string };

const TEMPLATE = (code: string) =>
  `${code} is your Garba Circle code. Valid for 5 minutes. Do not share it with anyone.`;

async function sendViaMsg91(phone: string, code: string): Promise<SmsResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!authKey || !templateId) throw new Error("MSG91 keys missing");

  const res = await fetch("https://control.msg91.com/api/v5/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", authkey: authKey },
    body: JSON.stringify({
      template_id: templateId,
      mobile: phone,
      otp: code,
      otp_expiry: 5,
    }),
  });
  if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`);
  return { delivered: true };
}

async function sendViaTwilio(phone: string, code: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Twilio keys missing");

  const body = new URLSearchParams({
    To: "+" + phone,
    From: from,
    Body: TEMPLATE(code),
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return { delivered: true };
}

export function isDevOtp(): boolean {
  return devOtpAllowed();
}

export class SmsNotConfiguredError extends Error {
  constructor() {
    super(
      "SMS delivery is not configured. Set SMS_PROVIDER (msg91 or twilio) and its keys.",
    );
  }
}

export async function sendOtp(phone: string, code: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "console";

  if (provider === "msg91") return sendViaMsg91(phone, code);
  if (provider === "twilio") return sendViaTwilio(phone, code);

  // Handing the code back to the caller means anyone can sign in as any
  // number, so a deployed environment has to opt in explicitly.
  if (!devOtpAllowed()) throw new SmsNotConfiguredError();

  console.log(`\n  [Garba Circle] OTP for +${phone} is ${code}\n`);
  return { delivered: true, devCode: code };
}
