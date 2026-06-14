// The dev-safe EmailSender (ADR-0012). Selected when RESEND_API_KEY is absent, so
// a fresh clone runs the register→verify flow with no secrets to obtain: instead
// of sending mail, it prints the message — crucially the verification/claim link
// inside `text` — to the server log, where a local developer (or an agent) reads
// it and follows the link by hand.

import type { EmailMessage, EmailSender } from "./port";

export class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    // One framed block so the link is easy to spot in a noisy dev log.
    console.log(
      [
        "",
        "──────────────────────────────────────────────────────────────",
        "📧 [email:console] no RESEND_API_KEY set — email not sent, logged instead",
        `   To:      ${message.to}`,
        `   Subject: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  }
}
