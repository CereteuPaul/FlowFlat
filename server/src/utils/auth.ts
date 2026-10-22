import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "flowflat_super_secret_dev_key";
// Tokens expire after 8 hours (or customize as needed)
const JWT_EXPIRES_IN = "8h";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  householdId: string | null;
}

// Password rules: >=8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
export function validatePassword(password: string): {
  isValid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long.",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one uppercase letter.",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one number.",
    };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      isValid: false,
      message:
        "Password must contain at least one special character (!@#$%^&*...).",
    };
  }
  return { isValid: true };
}

// Hash password
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

// Compare password
export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Generate JWT Session Token
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify JWT Session Token
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Generate 6-digit uppercase invite code (e.g. "FLW482")
export function generateInviteCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// Generate random verification token for email activation
export function generateEmailToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
