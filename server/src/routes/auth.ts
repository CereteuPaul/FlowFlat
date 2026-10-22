import { Router, Request, Response } from "express";
import { prisma } from "../index";
import {
  validatePassword,
  hashPassword,
  comparePassword,
  signToken,
  generateEmailToken,
} from "../utils/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

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
    const verificationToken = generateEmailToken();

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        verificationToken,
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

    // In local development, log activation URL so you can activate instantly
    console.log(`\n📬 [EMAIL VERIFICATION SIMULATOR]`);
    console.log(`To activate account for ${user.email}, visit:`);
    console.log(
      `http://localhost:4000/api/auth/verify-email?token=${verificationToken}\n`,
    );

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

    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return res
        .status(404)
        .send("<h3>Verification token not found or already used.</h3>");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationToken: null,
      },
    });

    return res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color: #10B981;">Email verified successfully!</h2>
        <p>You can now return to FlowFlat and log in.</p>
      </div>
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
        household: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
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

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      householdId: user.householdId,
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        householdId: user.householdId,
        household: user.household,
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
        role: true,
        avatarColor: true,
        status: true,
        householdId: true,
        household: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarColor: true,
                status: true,
              },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    console.error("[Get Me Error]", error);
    return res.status(500).json({ error: "Failed to retrieve profile." });
  }
});

export default router;
