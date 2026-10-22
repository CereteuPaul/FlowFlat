import { Router, Request, Response } from "express";
import { prisma, io } from "../index";
import { authenticate } from "../middleware/auth";
import { generateInviteCode } from "../utils/auth";

const router = Router();

// All household endpoints require being logged in
router.use(authenticate);

// 1. CREATE A NEW HOUSEHOLD
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user!.userId;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Household name is required." });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (currentUser?.householdId) {
      return res
        .status(400)
        .json({ error: "You are already a member of a household." });
    }

    let inviteCode = generateInviteCode();
    let isCodeUnique = false;
    while (!isCodeUnique) {
      const existing = await prisma.household.findUnique({
        where: { inviteCode },
      });
      if (!existing) {
        isCodeUnique = true;
      } else {
        inviteCode = generateInviteCode();
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: {
          name: name.trim(),
          inviteCode,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          householdId: household.id,
          role: "HOUSEHOLD_ADMIN",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          householdId: true,
        },
      });

      return { household, user: updatedUser };
    });

    return res.status(201).json({
      message: "Household created successfully!",
      household: result.household,
      user: result.user,
    });
  } catch (error) {
    console.error("[Create Household Error]", error);
    return res.status(500).json({ error: "Failed to create household." });
  }
});

// 2. SUBMIT A JOIN REQUEST VIA 6-DIGIT CODE (Pending Admin Approval)
router.post("/join", async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user!.userId;

    if (!inviteCode || typeof inviteCode !== "string") {
      return res
        .status(400)
        .json({ error: "A 6-character invite code is required." });
    }

    const formattedCode = inviteCode.trim().toUpperCase();

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (currentUser?.householdId) {
      return res
        .status(400)
        .json({ error: "You are already an active member of a household." });
    }

    const targetHousehold = await prisma.household.findUnique({
      where: { inviteCode: formattedCode },
    });

    if (!targetHousehold) {
      return res
        .status(404)
        .json({ error: "Invalid invite code. No household found." });
    }

    // Check if an existing request is already pending
    const existingRequest = await prisma.joinRequest.findUnique({
      where: {
        householdId_userId: {
          householdId: targetHousehold.id,
          userId,
        },
      },
    });

    if (existingRequest && existingRequest.status === "PENDING") {
      return res.status(400).json({
        error:
          "You already have a pending join request for this household. Please wait for admin approval.",
      });
    }

    // Create or reset join request to PENDING
    const joinRequest = await prisma.joinRequest.upsert({
      where: {
        householdId_userId: {
          householdId: targetHousehold.id,
          userId,
        },
      },
      update: {
        status: "PENDING",
        createdAt: new Date(),
      },
      create: {
        householdId: targetHousehold.id,
        userId,
        status: "PENDING",
      },
    });

    // Notify Household Admins in real-time via Socket.io
    io.to(targetHousehold.id).emit("join_request_received", {
      requestId: joinRequest.id,
      householdId: targetHousehold.id,
      user: {
        id: currentUser!.id,
        name: currentUser!.name,
        email: currentUser!.email,
      },
    });

    return res.json({
      message: `Join request sent to ${targetHousehold.name}! An admin must approve your request before you can enter.`,
      pending: true,
      householdName: targetHousehold.name,
    });
  } catch (error) {
    console.error("[Join Household Error]", error);
    return res.status(500).json({ error: "Failed to submit join request." });
  }
});

// 3. GET PENDING JOIN REQUESTS FOR CURRENT HOUSEHOLD (Admin Only)
router.get("/requests", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });

    if (!caller?.householdId || caller.role !== "HOUSEHOLD_ADMIN") {
      return res
        .status(403)
        .json({ error: "Only household admins can view join requests." });
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        householdId: caller.householdId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ requests });
  } catch (error) {
    console.error("[Get Requests Error]", error);
    return res.status(500).json({ error: "Failed to retrieve join requests." });
  }
});

router.patch("/members/:id/role", async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id as string;
    const { newRole } = req.body;
    const callerId = req.user!.userId;

    const validRoles = ["HOUSEHOLD_ADMIN", "MEMBER", "RESTRICTED_MEMBER"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({
        error: `Invalid role. Allowed values: ${validRoles.join(", ")}`,
      });
    }

    // Fetch caller live from database to check their true role
    const caller = await prisma.user.findUnique({
      where: { id: callerId },
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "Target user not found." });
    }

    const isPlatformAdmin = caller?.role === "PLATFORM_ADMIN";
    const isHouseholdAdmin =
      caller?.role === "HOUSEHOLD_ADMIN" &&
      caller?.householdId === targetUser.householdId;

    if (!isPlatformAdmin && !isHouseholdAdmin) {
      return res.status(403).json({
        error: "Only a Household Admin of this flat can update member roles.",
      });
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return res.json({
      message: `Role for ${updated.name} updated to ${updated.role}.`,
      user: updated,
    });
  } catch (error) {
    console.error("[Update Role Error]", error);
    return res.status(500).json({ error: "Failed to update member role." });
  }
});

// 4. APPROVE OR REJECT JOIN REQUEST (Admin Only)
router.patch("/requests/:id", async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id as string;
    const { action, assignedRole = "MEMBER" } = req.body; // action: 'APPROVE' | 'REJECT'
    const callerId = req.user!.userId;

    if (!["APPROVE", "REJECT"].includes(action)) {
      return res
        .status(400)
        .json({ error: "Action must be APPROVE or REJECT." });
    }

    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    if (!caller?.householdId || caller.role !== "HOUSEHOLD_ADMIN") {
      return res.status(403).json({
        error: "Only household admins can approve or reject join requests.",
      });
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!joinRequest || joinRequest.householdId !== caller.householdId) {
      return res
        .status(404)
        .json({ error: "Join request not found for your household." });
    }

    if (action === "REJECT") {
      await prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" },
      });

      // Notify the rejected user
      io.emit(`user_${joinRequest.userId}_status`, { status: "REJECTED" });

      return res.json({
        message: `Request from ${joinRequest.user.name} has been rejected.`,
      });
    }

    // APPROVE: Link user to household and assign role
    await prisma.$transaction([
      prisma.user.update({
        where: { id: joinRequest.userId },
        data: {
          householdId: caller.householdId,
          role:
            assignedRole === "RESTRICTED_MEMBER"
              ? "RESTRICTED_MEMBER"
              : "MEMBER",
        },
      }),
      prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      }),
    ]);

    // Broadcast real-time approval event to the approved user and the household
    io.emit(`user_${joinRequest.userId}_status`, {
      status: "APPROVED",
      householdId: caller.householdId,
    });
    io.to(caller.householdId).emit("member_joined");

    return res.json({
      message: `${joinRequest.user.name} has been approved and added to the household as ${assignedRole}.`,
    });
  } catch (error) {
    console.error("[Review Request Error]", error);
    return res.status(500).json({ error: "Failed to review join request." });
  }
});

// 5. GET CURRENT USER'S PENDING JOIN REQUEST (If any)
router.get("/my-request", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const pendingRequest = await prisma.joinRequest.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
      include: {
        household: {
          select: { name: true },
        },
      },
    });

    return res.json({ pendingRequest });
  } catch (error) {
    console.error("[My Request Error]", error);
    return res.status(500).json({ error: "Failed to check request status." });
  }
});

// 6. GET CURRENT HOUSEHOLD DETAILS
router.get("/current", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user || !user.householdId) {
      return res
        .status(404)
        .json({ error: "You are not part of any household yet." });
    }

    const household = await prisma.household.findUnique({
      where: { id: user.householdId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
            status: true,
          },
        },
      },
    });

    return res.json({ household });
  } catch (error) {
    console.error("[Get Household Error]", error);
    return res
      .status(500)
      .json({ error: "Failed to retrieve household details." });
  }
});

export default router;
