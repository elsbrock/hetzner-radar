// mailService.ts

import { dev } from "$app/environment";

type PlatformEnv = App.Platform extends { env?: infer E }
  ? E
  : Record<string, never>;

/** Structural type of the Cloudflare Email Sending `send_email` binding. */
export interface EmailBinding {
  send(message: {
    from: string | { name: string; email: string };
    to: string;
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

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

  if (!env?.EMAIL) {
    console.warn("EMAIL binding is not configured; skipping email send.");
    if (!dev) {
      throw new Error("Email service is not configured.");
    }
    return;
  }
  const { from, to, subject, text } = mailOptions;

  try {
    await env.EMAIL.send({
      from: from.name && from.name.trim() ? from : from.email,
      to,
      subject,
      text,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send email:", message);
    throw new Error(`Failed to send email: ${message}`);
  }
}
