// mailService.ts

import { dev } from '$app/environment';

interface MailOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(env: any, mailOptions: MailOptions): Promise<void> {
  if (dev) {
    console.log(JSON.stringify(mailOptions, undefined, 2));
  } else {
    await env.EMAIL_QUEUE.send(mailOptions);
  }
}