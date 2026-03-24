// mailService.ts

import { dev } from "$app/environment";

type PlatformEnv = App.Platform extends { env?: infer E }
  ? E
  : Record<string, never>;

interface MailOptions {
  from: {
    name: string;
    email: string;
  };
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(
  env: PlatformEnv | undefined,
  mailOptions: MailOptions,
): Promise<void> {
  if (dev) {
    console.log(JSON.stringify(mailOptions, undefined, 2));
  }

  if (!env?.FORWARDEMAIL_API_KEY) {
    console.warn(
      "FORWARDEMAIL_API_KEY is not configured; skipping email send.",
    );
    if (!dev) {
      throw new Error("Email service is not configured.");
    }
    return;
  }
  const { from, to, subject, text } = mailOptions;
  const fromField =
    from.name && from.name.trim()
      ? `"${from.name}" <${from.email}>`
      : from.email;

  const body = new URLSearchParams();
  body.append("from", fromField);
  body.append("to", to);
  body.append("subject", subject);
  body.append("text", text);

  // Construct Basic Auth header: username is API key, password is empty string
  const credentials =
    typeof btoa === "function"
      ? btoa(`${env.FORWARDEMAIL_API_KEY}:`)
      : Buffer.from(`${env.FORWARDEMAIL_API_KEY}:`).toString("base64");

  const response = await fetch("https://api.forwardemail.net/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send email:", response.status, errorText);
    throw new Error(`Failed to send email: ${response.status}`);
  }
}
