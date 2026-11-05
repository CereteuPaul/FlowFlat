import { Router, Request, Response } from "express";
import { prisma } from "../index";
import {
  validatePassword,
  hashPassword,
  comparePassword,
  signToken,
  generateEmailToken,
  hashEmailToken,
} from "../utils/auth";
import { authenticate } from "../middleware/auth";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "../utils/email";
const router = Router();

function getPasswordResetToken(): string {
  return generateEmailToken();
}

// 1. REQUEST PASSWORD RESET
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const email =
      typeof req.body.email === "string" ? req.body.email.toLowerCase().trim() : "";

    if (!email) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const resetToken = getPasswordResetToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashEmailToken(resetToken),
          passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    }

    return res.json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("[Forgot Password Error]", error);
    return res.status(500).json({ error: "Unable to process password reset request." });
  }
});

// 2. RESET PASSWORD WITH ONE-TIME TOKEN
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ error: "Token, password, and confirmation are required." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.message });
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: hashEmailToken(token),
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) {
      return res.status(400).json({ error: "This password reset link is invalid or expired." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
    return res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (error) {
    console.error("[Reset Password Error]", error);
    return res.status(500).json({ error: "Unable to reset password." });
  }
});

// 3. CHANGE PASSWORD FOR AUTHENTICATED USER
router.post("/change-password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, password, confirmPassword } = req.body;
    if (!currentPassword || !password || !confirmPassword) {
      return res.status(400).json({ error: "All password fields are required." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.message });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
    return res.json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("[Change Password Error]", error);
    return res.status(500).json({ error: "Unable to change password." });
  }
});

// 1. REGISTER
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const emailVerificationToken = generateEmailToken();

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        emailVerificationToken,
        isEmailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isEmailVerified: true,
      },
    });

    console.log(`\n📬 [EMAIL VERIFICATION SIMULATOR]`);
    console.log(`To activate account for ${user.email}, visit:`);
    console.log(
      `http://localhost:4000/api/auth/verify-email?token=${emailVerificationToken}\n`,
    );
    await sendWelcomeEmail(user.email, user.name, emailVerificationToken);
    return res.status(201).json({
      message:
        "Account created! Please check your terminal or email to verify your account.",
      user,
    });
  } catch (error) {
    console.error("[Register Error]", error);
    return res.status(500).json({ error: "Failed to create account." });
  }
});

// 2. VERIFY EMAIL
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res
        .status(400)
        .send("<h3>Invalid or missing verification token.</h3>");
    }

    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
    });

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");

    if (!user) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Account Active - FlowFlat</title>
          <meta http-equiv="refresh" content="3;url=${clientUrl}/?verified=true">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070A0F; color: #F1F5F9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0F141E; border: 1px solid #1E293B; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h2 { color: #38BDF8; margin: 0 0 10px 0; font-size: 22px; }
            p { color: #94A3B8; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5; }
            .btn { display: inline-block; background: #0284C7; color: #FFFFFF; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Account Already Active!</h2>
            <p>This verification link has already been confirmed. Your account is ready.</p>
            <a href="${clientUrl}/?verified=true" class="btn">Proceed to Login</a>
          </div>
        </body>
        </html>
      `);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Email Verified - FlowFlat</title>
        <meta http-equiv="refresh" content="3;url=${clientUrl}/?verified=true">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070A0F; color: #F1F5F9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #0F141E; border: 1px solid #1E293B; border-radius: 16px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h2 { color: #10B981; margin: 0 0 10px 0; font-size: 22px; }
          p { color: #94A3B8; font-size: 15px; margin: 0 0 24px 0; line-height: 1.5; }
          .btn { display: inline-block; background: #0284C7; color: #FFFFFF; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Email Verified Successfully!</h2>
          <p>Your account is now activated. Redirecting you to FlowFlat...</p>
          <a href="${clientUrl}/?verified=true" class="btn">Return to Login</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("[Verify Email Error]", error);
    return res.status(500).send("<h3>Server error verifying email.</h3>");
  }
});

// 3. LOGIN
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        activeHousehold: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            members: {
              select: {
                id: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarColor: true,
                    status: true,
                  },
                },
              },
              orderBy: { user: { name: "asc" } },
            },
          },
        },
        memberships: {
          select: {
            id: true,
            role: true,
            household: {
              select: {
                id: true,
                name: true,
                inviteCode: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        error:
          "Please verify your email before logging in. Check your server console for the link.",
      });
    }

    const activeMembership = user.memberships.find(
      (m) => m.household.id === user.activeHouseholdId,
    );
    const roleInActiveHousehold = activeMembership
      ? activeMembership.role
      : user.role || "MEMBER";

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: roleInActiveHousehold,
      householdId: user.activeHouseholdId,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        status: user.status,
        role: roleInActiveHousehold,
        householdId: user.activeHouseholdId,
        activeHouseholdId: user.activeHouseholdId,
        activeHousehold: user.activeHousehold,
        household: user.activeHousehold
          ? {
              id: user.activeHousehold.id,
              name: user.activeHousehold.name,
              inviteCode: user.activeHousehold.inviteCode,
              users: user.activeHousehold.members.map((m) => ({
                ...m.user,
                role: m.role,
              })),
            }
          : null,
        memberships: user.memberships,
      },
    });
  } catch (error) {
    console.error("[Login Error]", error);
    return res.status(500).json({ error: "An error occurred during login." });
  }
});

// 4. GET CURRENT LOGGED IN USER (/me)
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarColor: true,
        status: true,
        activeHouseholdId: true,
        activeHousehold: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            members: {
              select: {
                id: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarColor: true,
                    status: true,
                  },
                },
              },
              orderBy: { user: { name: "asc" } },
            },
          },
        },
        memberships: {
          select: {
            id: true,
            role: true,
            household: {
              select: {
                id: true,
                name: true,
                inviteCode: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const activeMembership = user.memberships.find(
      (m) => m.household.id === user.activeHouseholdId,
    );
    const roleInActiveHousehold = activeMembership
      ? activeMembership.role
      : "MEMBER";

    const formattedUser = {
      ...user,
      role: roleInActiveHousehold,
      householdId: user.activeHouseholdId,
      household: user.activeHousehold
        ? {
            id: user.activeHousehold.id,
            name: user.activeHousehold.name,
            inviteCode: user.activeHousehold.inviteCode,
            users: user.activeHousehold.members.map((m) => ({
              ...m.user,
              role: m.role,
            })),
          }
        : null,
    };

    return res.json({ user: formattedUser });
  } catch (error) {
    console.error("[Get Me Error]", error);
    return res.status(500).json({ error: "Failed to retrieve profile." });
  }
});

export default router;
