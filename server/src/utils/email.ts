import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, "") : "";

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function getFromAddress(): string {
  const user =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    "cereteupaul374@gmail.com";
  return process.env.EMAIL_FROM || `FlowFlat <${user}>`;
}

interface SendMailParams {
  toEmail: string;
  toName: string;
  subject: string;
  html: string;
}

// Unified email dispatcher (Brevo HTTP API for Render/Production + Nodemailer fallback for local)
async function dispatchEmail({ toEmail, toName, subject, html }: SendMailParams) {
  const brevoKey = process.env.BREVO_API_KEY;
  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    "cereteupaul374@gmail.com";

  // 1. Prioritize Brevo REST API (uses HTTP port 443 - never blocked by Render)
  if (brevoKey) {
    try {
      console.log(`[Email] Dispatching via Brevo HTTP API to ${toEmail}...`);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": brevoKey.trim(),
        },
        body: JSON.stringify({
          sender: { name: "FlowFlat", email: senderEmail },
          to: [{ email: toEmail, name: toName || toEmail }],
          subject,
          htmlContent: html,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as any;

      if (!response.ok) {
        console.error("[Brevo Error Response]", data);
        return { success: false, error: data };
      }

      console.log(`[Brevo Email Sent] Successfully sent to ${toEmail}. MessageId:`, data.messageId);
      return { success: true, messageId: data.messageId };
    } catch (err) {
      console.error("[Brevo Fetch Exception]", err);
      return { success: false, error: err };
    }
  }

  // 2. Fallback to Nodemailer SMTP (local development)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      console.log(`[Email] Dispatching via Nodemailer SMTP to ${toEmail}...`);
      const transporter = getTransporter();
      const info = await transporter.sendMail({
        from: getFromAddress(),
        to: toEmail,
        subject,
        html,
      });
      console.log(`[Nodemailer Email Sent] to ${toEmail}. MessageId:`, info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[Nodemailer Error]", err);
      return { success: false, error: err };
    }
  }

  console.warn(
    "[Email Warning] Neither BREVO_API_KEY nor SMTP credentials are configured. Email skipped.",
  );
  return { success: false, error: "No email credentials configured." };
}

// 1. Account Confirmation & Verification Email
export async function sendWelcomeEmail(
  toEmail: string,
  userName: string,
  verificationToken: string,
) {
  const rawServerUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.SERVER_URL ||
    "https://flowflat.onrender.com";
  const serverUrl = rawServerUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  const verificationUrl = `${serverUrl}/api/auth/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070A0F; color: #F1F5F9; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #0F141E; border: 1px solid #1E293B; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
        .logo-text { font-size: 20px; font-weight: bold; color: #38BDF8; letter-spacing: -0.5px; }
        h1 { font-size: 22px; color: #FFFFFF; margin-top: 0; margin-bottom: 12px; }
        p { font-size: 15px; color: #94A3B8; line-height: 1.6; margin-bottom: 20px; }
        .btn-wrapper { text-align: center; margin: 30px 0; }
        .btn { display: inline-block; background: #0284C7; color: #FFFFFF !important; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; }
        .btn:hover { background: #0369A1; }
        .footer { border-top: 1px solid #1E293B; padding-top: 20px; margin-top: 28px; font-size: 12px; color: #64748B; text-align: center; }
        .alt-link { font-size: 12px; color: #64748B; word-break: break-all; margin-top: 16px; }
        .alt-link a { color: #38BDF8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="logo-text">FlowFlat</span>
        </div>
        <h1>Welcome, ${userName}! 👋</h1>
        <p>Thanks for joining FlowFlat. To activate your account and start managing your flat, please verify your email address by clicking the button below:</p>
        <div class="btn-wrapper">
          <a href="${verificationUrl}" class="btn" target="_blank">Verify My Email</a>
        </div>
        <p class="alt-link">Or copy and paste this link in your browser:<br/><a href="${verificationUrl}">${verificationUrl}</a></p>
        <div class="footer">
          <p>If you didn't create an account on FlowFlat, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchEmail({
    toEmail,
    toName: userName,
    subject: "Welcome to FlowFlat! Please confirm your email 👋",
    html,
  });
}

export async function sendScheduleReminderEmail(
  toEmail: string,
  toName: string,
  title: string,
  startTime: Date,
  senderName: string,
) {
  const formattedDate = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(startTime);

  return dispatchEmail({
    toEmail,
    toName,
    subject: `Reminder: ${title}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>FlowFlat schedule reminder</h2>
        <p>${senderName} reminded you about <strong>${title}</strong>.</p>
        <p>Scheduled for: <strong>${formattedDate}</strong></p>
        <p>Open FlowFlat to update the schedule status.</p>
      </div>
    `,
  });
}

// 2. Bill / Payment Reminder Email
export async function sendBillReminderEmail(
  toEmail: string,
  userName: string,
  billTitle: string,
  amount: number,
  dueDate: string,
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #070A0F; color: #F1F5F9; margin: 0; padding: 24px; }
        .container { max-width: 520px; margin: 0 auto; background: #0F141E; border: 1px solid #1E293B; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        h1 { font-size: 20px; color: #F43F5E; margin-top: 0; }
        p { font-size: 15px; color: #94A3B8; line-height: 1.6; }
        .bill-card { background-color: #070A0F; padding: 18px; border-radius: 12px; border: 1px solid #1E293B; margin: 20px 0; }
        .bill-title { font-size: 17px; font-weight: bold; color: #FFFFFF; margin: 0 0 6px 0; }
        .bill-amount { font-size: 20px; font-weight: bold; color: #38BDF8; margin: 0 0 4px 0; }
        .bill-due { font-size: 14px; color: #F59E0B; margin: 0; }
        .footer { border-top: 1px solid #1E293B; padding-top: 20px; margin-top: 28px; font-size: 12px; color: #64748B; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Upcoming Bill Reminder 💸</h1>
        <p>Hi ${userName},</p>
        <p>You have an open share on a household bill that requires settlement:</p>
        <div class="bill-card">
          <div class="bill-title">${billTitle}</div>
          <div class="bill-amount">€${amount.toFixed(2)}</div>
          <div class="bill-due">Due Date: ${dueDate}</div>
        </div>
        <p>Please settle your share or mark it as paid on FlowFlat.</p>
        <div class="footer">
          <p>Sent automatically from your FlowFlat household.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return dispatchEmail({
    toEmail,
    toName: userName,
    subject: `⏰ Payment Reminder: ${billTitle}`,
    html,
  });
}
