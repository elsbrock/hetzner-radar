import { WorkerMailer } from 'worker-mailer'

export default {
  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      const { from, to, subject, text } = message.body;

      const mailer = await WorkerMailer.connect({
        host: "smtps-proxy.fastmail.com",
        port: 465,
        secure: true,
        credentials: {
          username: env.SMTP_USERNAME,
          password: env.SMTP_PASSWORD,
        },
        authType: "plain",
      });

      const emailOptions = {
        from,
        to,
        subject,
        text,
      };

      await mailer.send(emailOptions);
    }
  },
};
