import nodemailer from "nodemailer";

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, "") : "";

  if (!user || !pass) {
    console.warn(
      "[Email Warning] SMTP_USER or SMTP_PASS not set in .env. Emails will not be sent.",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function getFromAddress(): string {
  const user = process.env.SMTP_USER || "noreply@flowflat.local";
  return process.env.EMAIL_FROM || `FlowFlat <${user}>`;
}

// 1. Account Confirmation & Verification Email
export async function sendWelcomeEmail(
  toEmail: string,
  userName: string,
  verificationToken: string,
) {
  try {
    const transporter = getTransporter();
    const serverUrl = process.env.SERVER_URL || "http://localhost:4000";
    const verificationUrl = `${serverUrl}/api/auth/verify-email?token=${verificationToken}`;

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: toEmail,
      subject: "Welcome to FlowFlat! Please confirm your email 👋",
      html: `
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
      `,
    });

    console.log(`[Email] Verification email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Error - Welcome/Verification]", error);
    return { success: false, error };
  }
}

// 2. Bill / Payment Reminder Email
export async function sendBillReminderEmail(
  toEmail: string,
  userName: string,
  billTitle: string,
  amount: number,
  dueDate: string,
) {
  try {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: toEmail,
      subject: `⏰ Payment Reminder: ${billTitle}`,
      html: `
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
      `,
    });

    console.log(`[Email] Bill reminder sent to ${toEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email Error - Bill Reminder]", error);
    return { success: false, error };
  }
}
