/**
 * Email Adapter
 *
 * Supports two modes:
 * 1. SMTP (if EMAIL_SMTP_* env vars are set)
 * 2. Stub mode (logs to CommunicationLog, returns success)
 *
 * Mailbox password is NEVER stored in application database.
 * Credentials come from environment variables only.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
  clientId?: string;
  orderId?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: "smtp" | "stub";
  /** NOT_CONFIGURED when no SMTP credentials are set. The caller MUST NOT
   * record this as SENT — it is a fake success otherwise. */
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const smtpHost = process.env.EMAIL_SMTP_HOST;
  const smtpPort = process.env.EMAIL_SMTP_PORT;
  const smtpUser = process.env.EMAIL_SMTP_USER;
  const smtpPass = process.env.EMAIL_SMTP_PASS;
  const fromEmail = process.env.EMAIL_FROM || "noreply@blinds.am";

  // If SMTP credentials are configured, use real SMTP
  if (smtpHost && smtpUser && smtpPass) {
    try {
      // Dynamic import of nodemailer (not installed by default)
      // In production, install nodemailer and use it here
      // For now, we log and return a NOT_CONFIGURED-equivalent unless a real
      // transport is wired. We MUST NOT claim SENT without a real send.
      console.log("[EMAIL] SMTP configured but transport not wired (nodemailer not installed):", { to: message.to, subject: message.subject, from: fromEmail });
      return {
        success: false,
        error: "SMTP transport not implemented — install nodemailer and wire sendEmail.",
        provider: "smtp",
        status: "FAILED",
      };
    } catch (e: any) {
      return { success: false, error: e?.message ?? "SMTP failed", provider: "smtp", status: "FAILED" };
    }
  }

  // No credentials configured — honest NOT_CONFIGURED. Never fake success.
  console.log("[EMAIL] Not configured:", { to: message.to, subject: message.subject, from: fromEmail });
  return {
    success: false,
    error: "Email provider not configured (EMAIL_SMTP_*).",
    provider: "stub",
    status: "NOT_CONFIGURED",
  };
}

/**
 * WhatsApp Business Adapter
 *
 * Uses official WhatsApp Business Cloud API if configured.
 * Falls back to stub mode.
 *
 * Requires:
 * - WHATSAPP_BUSINESS_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 *
 * Never bypasses provider policy.
 */

export interface WhatsAppMessage {
  to: string; // phone number in international format, e.g. 37499123456
  body: string;
  clientId?: string;
  orderId?: string;
  templateName?: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  error?: string;
  provider: "whatsapp-cloud" | "stub";
}

export async function sendWhatsApp(message: WhatsAppMessage): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_BUSINESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (token && phoneNumberId) {
    try {
      // Use official WhatsApp Business Cloud API
      const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.to,
          type: "text",
          text: { body: message.body },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, status: "FAILED", error: err, provider: "whatsapp-cloud" };
      }

      const data = await res.json();
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: "SENT",
        provider: "whatsapp-cloud",
      };
    } catch (e: any) {
      return { success: false, status: "FAILED", error: e?.message ?? "WhatsApp API failed", provider: "whatsapp-cloud" };
    }
  }

  // Not configured — honest NOT_CONFIGURED. Never fake success.
  console.log("[WHATSAPP] Not configured:", { to: message.to, body: message.body.slice(0, 100) });
  return {
    success: false,
    error: "WhatsApp provider not configured (WHATSAPP_BUSINESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID).",
    status: "NOT_CONFIGURED",
    provider: "stub",
  };
}

/**
 * Check WhatsApp opt-in status for a client.
 * In production, this would check a consent database.
 */
export function isWhatsAppOptedIn(clientPreferredChannel: string): boolean {
  return clientPreferredChannel === "whatsapp";
}
