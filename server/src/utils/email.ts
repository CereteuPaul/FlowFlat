import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender provided by Resend during testing
const FROM_EMAIL =
  process.env.NODE_ENV === "production"
    ? "FlowFlat <onboarding@resend.dev>"
    : "FlowFlat <onboarding@resend.dev>";

// 1. Account Confirmation Email
export async function sendWelcomeEmail(toEmail: string, userName: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Welcome to FlowFlat!",
      html: `
        <div style="font-family: sans-serif; background-color: #0F141E; color: #fff; padding: 24px; border-radius: 16px;">
          <h2 style="color: #38bdf8;">Welcome to FlowFlat, ${userName}! 👋</h2>
          <p style="color: #94a3b8;">Your account has been successfully created.</p>
          <p style="color: #94a3b8;">You can now create a new flat or join an existing one using an invite code.</p>
          <hr style="border-color: #1e293b; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">If you didn't create this account, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[Email Error - Welcome]", error);
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
    await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `⏰ Payment Reminder: ${billTitle}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0F141E; color: #fff; padding: 24px; border-radius: 16px;">
          <h2 style="color: #f43f5e;">Upcoming Bill Reminder 💸</h2>
          <p style="color: #94a3b8;">Hi ${userName}, you have an upcoming bill in your flat:</p>
          <div style="background-color: #070a0f; padding: 16px; border-radius: 12px; border: 1px solid #1e293b; margin: 16px 0;">
            <p style="margin: 4px 0; font-weight: bold; font-size: 16px; color: #fff;">${billTitle}</p>
            <p style="margin: 4px 0; color: #38bdf8; font-weight: bold;">Amount: €${amount.toFixed(2)}</p>
            <p style="margin: 4px 0; color: #f59e0b;">Due Date: ${dueDate}</p>
          </div>
          <p style="color: #94a3b8;">Please settle your share or mark it as paid on FlowFlat.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[Email Error - Bill Reminder]", error);
  }
}
