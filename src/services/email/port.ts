// The EmailSender port (ADR-0012). Transactional email is the one external SaaS
// dependency we degrade to a dev-safe stub when its key is absent: callers depend
// on this interface and never branch on environment. A Resend adapter sends real
// mail in deployed environments; a console adapter prints links to the server log
// locally — so the register→verify flow is exercisable with no Resend key.
//
// Slice 06 uses it for verification email; the claim-invite flow (feature 01)
// will reuse the same port.

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always set — links must survive in text-only clients. */
  text: string;
  /** Optional HTML body; adapters that support it prefer it over `text`. */
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
