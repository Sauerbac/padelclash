// The production EmailSender (ADR-0012): Resend, the one thing not worth
// self-hosting (ADR-0010). Selected when RESEND_API_KEY is present. Mail delivery
// is the only path a real key unlocks; everything else runs against the console
// adapter so the rest of the app is testable without one.

import { Resend } from "resend";
import type { EmailMessage, EmailSender } from "./port";

export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }
  }
}
