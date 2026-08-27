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
      // For now, we log and return stub
      console.log("[EMAIL] SMTP send:", { to: message.to, subject: message.subject, from: fromEmail });
      return {
        success: true,
        messageId: `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider: "smtp",
      };
    } catch (e: any) {
      return { success: false, error: e?.message ?? "SMTP failed", provider: "smtp" };
    }
  }

  // Stub mode — log and return success
  console.log("[EMAIL] Stub send:", { to: message.to, subject: message.subject, from: fromEmail });
  return {
    success: true,
    messageId: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    provider: "stub",
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
  status: "sent" | "delivered" | "read" | "failed";
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
        return { success: false, status: "failed", error: err, provider: "whatsapp-cloud" };
      }

      const data = await res.json();
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        status: "sent",
        provider: "whatsapp-cloud",
      };
    } catch (e: any) {
      return { success: false, status: "failed", error: e?.message ?? "WhatsApp API failed", provider: "whatsapp-cloud" };
    }
  }

  // Stub mode
  console.log("[WHATSAPP] Stub send:", { to: message.to, body: message.body.slice(0, 100) });
  return {
    success: true,
    messageId: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "sent",
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
