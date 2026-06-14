// EmailSender selection (ADR-0012). The whole point of the port: this is the ONE
// place environment is consulted. RESEND_API_KEY present → real mail; absent →
// the console stub, so a keyless clone still runs register→verify end to end.
//
// `selectEmailSender` is the pure decision (config in, sender out) so it can be
// unit-tested without touching process.env; `getEmailSender` is the cached
// production wrapper that reads the (optional) env vars.

import { ConsoleEmailSender } from "./console";
import { ResendEmailSender } from "./resend";
import type { EmailSender } from "./port";

export type { EmailMessage, EmailSender } from "./port";
export { ConsoleEmailSender } from "./console";
export { ResendEmailSender } from "./resend";

const DEFAULT_FROM = "PadelClash <onboarding@localhost>";

export interface EmailConfig {
  resendApiKey?: string;
  emailFrom: string;
}

/** Pure selection: a real key picks Resend, otherwise the console stub. */
export function selectEmailSender(config: EmailConfig): EmailSender {
  if (config.resendApiKey) {
    return new ResendEmailSender(config.resendApiKey, config.emailFrom);
  }
  return new ConsoleEmailSender();
}

let cached: EmailSender | undefined;

/** The process-wide sender, selected once from the (optional) email env vars. */
export function getEmailSender(): EmailSender {
  if (!cached) {
    cached = selectEmailSender({
      resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
      emailFrom: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
    });
  }
  return cached;
}
