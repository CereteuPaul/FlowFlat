import { Router, Request, Response } from "express";
import { prisma, io } from "../index";
import { authenticate } from "../middleware/auth";
import { generateInviteCode } from "../utils/auth";

const router = Router();

// All household endpoints require being logged in
router.use(authenticate);

// Shared helper function for processing a join request review
async function processJoinRequestReview(
  callerId: string,
  requestId: string,
  action: "APPROVE" | "REJECT",
  role: string | undefined,
  res: Response,
) {
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    include: { memberships: true },
  });

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    include: { household: true },
  });

  if (!joinRequest) {
    return res.status(404).json({ error: "Join request not found." });
  }

  const callerMembership = caller?.memberships.find(
    (m) => m.householdId === joinRequest.householdId,
  );

  if (
    callerMembership?.role !== "HOUSEHOLD_ADMIN" &&
    caller?.role !== "HOUSEHOLD_ADMIN"
  ) {
    return res
      .status(403)
      .json({ error: "Only Household Admins can review join requests." });
  }

  if (action === "REJECT") {
    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
    io.emit(`user_${joinRequest.userId}_status`, { status: "REJECTED" });
    return res.json({ message: "Request rejected." });
  }

  if (action === "APPROVE") {
    const targetRole = role || "MEMBER";

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    });

    await prisma.householdMember.upsert({
      where: {
        userId_householdId: {
          userId: joinRequest.userId,
          householdId: joinRequest.householdId,
        },
      },
      create: {
        userId: joinRequest.userId,
        householdId: joinRequest.householdId,
        role: targetRole,
      },
      update: {
        role: targetRole,
      },
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: joinRequest.userId },
    });

    // If user has no active household yet, activate this one
    if (!targetUser?.activeHouseholdId) {
      await prisma.user.update({
        where: { id: joinRequest.userId },
        data: {
          activeHouseholdId: joinRequest.householdId,
          householdId: joinRequest.householdId,
          role: targetRole,
        },
      });
    }

    io.emit(`user_${joinRequest.userId}_status`, {
      status: "APPROVED",
      householdId: joinRequest.householdId,
    });
    io.to(joinRequest.householdId).emit("member_joined");

    return res.json({ message: "Request approved successfully." });
  }

  return res.status(400).json({ error: "Invalid action provided." });
}

// 1. CREATE A NEW HOUSEHOLD (MULTIPLE ALLOWED)
router.post("/create", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.user!.userId;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Household name is required." });
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
      // Create household
      const household = await tx.household.create({
        data: {
          name: name.trim(),
          inviteCode,
        },
      });

      // Add user as HOUSEHOLD_ADMIN in HouseholdMember
      await tx.householdMember.create({
        data: {
          userId,
          householdId: household.id,
          role: "HOUSEHOLD_ADMIN",
        },
      });

      // Set this new household as active
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          activeHouseholdId: household.id,
          householdId: household.id,
          role: "HOUSEHOLD_ADMIN",
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

// 2. SUBMIT A JOIN REQUEST VIA 6-DIGIT CODE
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
    const targetHousehold = await prisma.household.findUnique({
      where: { inviteCode: formattedCode },
    });

    if (!targetHousehold) {
      return res
        .status(404)
        .json({ error: "Invalid invite code. No household found." });
    }

    // Check if user is already an active member of this specific household
    const existingMembership = await prisma.householdMember.findUnique({
      where: {
        userId_householdId: {
          userId,
          householdId: targetHousehold.id,
        },
      },
    });

    if (existingMembership) {
      return res
        .status(400)
        .json({ error: "You are already a member of this household." });
    }

    // Check if an existing request is pending
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

    const currentUser = await prisma.user.findUnique({ where: { id: userId } });

    // Notify Household Admins in real-time
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

// 3. GET PENDING JOIN REQUESTS (FOR ACTIVE HOUSEHOLD)
router.get("/pending-requests", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: callerId } });

    const activeHouseholdId = user?.activeHouseholdId || user?.householdId;
    if (!activeHouseholdId) {
      return res.json({ requests: [] });
    }

    const requests = await prisma.joinRequest.findMany({
      where: {
        householdId: activeHouseholdId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch pending requests." });
  }
});

// Alias for backwards compatibility
router.get("/requests", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: callerId } });
    const activeHouseholdId = user?.activeHouseholdId || user?.householdId;

    if (!activeHouseholdId) return res.json({ requests: [] });

    const requests = await prisma.joinRequest.findMany({
      where: {
        householdId: activeHouseholdId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ requests });
  } catch (error) {
    return res.status(500).json({ error: "Failed to retrieve requests." });
  }
});

// 4. REVIEW JOIN REQUEST (APPROVE / REJECT)
router.post(
  "/requests/:requestId/review",
  async (req: Request, res: Response) => {
    try {
      const callerId = req.user!.userId;
      const requestId = Array.isArray(req.params.requestId)
        ? req.params.requestId[0]
        : req.params.requestId;
      const { action, role } = req.body;

      return await processJoinRequestReview(
        callerId,
        requestId,
        action,
        role,
        res,
      );
    } catch (error) {
      console.error("[Review Request Error]", error);
      return res.status(500).json({ error: "Failed to process request." });
    }
  },
);

// BACKWARDS-COMPATIBLE REVIEW ALIAS (PATCH /requests/:id)
router.patch("/requests/:id", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const requestId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const { action, assignedRole, role } = req.body;

    return await processJoinRequestReview(
      callerId,
      requestId,
      action,
      assignedRole || role || "MEMBER",
      res,
    );
  } catch (error) {
    console.error("[Review Request Error]", error);
    return res.status(500).json({ error: "Failed to process request." });
  }
});

// 5. GET CURRENT USER'S PENDING JOIN REQUEST
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

// 6. SWITCH ACTIVE HOUSEHOLD
router.patch("/switch-active", async (req: Request, res: Response) => {
  try {
    const { householdId } = req.body;
    const userId = req.user!.userId;

    const membership = await prisma.householdMember.findUnique({
      where: {
        userId_householdId: { userId, householdId },
      },
    });

    if (!membership) {
      return res
        .status(403)
        .json({ error: "You are not a member of this household." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        activeHouseholdId: householdId,
        householdId: householdId,
        role: membership.role,
      },
      include: {
        activeHousehold: {
          include: {
            members: { include: { user: true } },
          },
        },
        memberships: {
          include: { household: true },
        },
      },
    });

    return res.json({ user: updatedUser });
  } catch (error) {
    console.error("[Switch Household Error]", error);
    return res
      .status(500)
      .json({ error: "Failed to switch active household." });
  }
});

// 7. UPDATE MEMBER ROLE
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

    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      include: { memberships: true },
    });

    const activeHouseholdId = caller?.activeHouseholdId || caller?.householdId;
    if (!activeHouseholdId) {
      return res.status(400).json({ error: "No active household selected." });
    }

    const callerMembership = caller.memberships.find(
      (m) => m.householdId === activeHouseholdId,
    );

    if (
      callerMembership?.role !== "HOUSEHOLD_ADMIN" &&
      caller.role !== "PLATFORM_ADMIN"
    ) {
      return res.status(403).json({
        error: "Only a Household Admin of this flat can update member roles.",
      });
    }

    const updatedMembership = await prisma.householdMember.update({
      where: {
        userId_householdId: {
          userId: targetUserId,
          householdId: activeHouseholdId,
        },
      },
      data: { role: newRole },
      include: { user: true },
    });

    return res.json({
      message: `Role for ${updatedMembership.user.name} updated to ${updatedMembership.role}.`,
    });
  } catch (error) {
    console.error("[Update Role Error]", error);
    return res.status(500).json({ error: "Failed to update member role." });
  }
});

// 8. REMOVE MEMBER (ADMIN ONLY)
router.delete("/members/:targetUserId", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const targetUserId = req.params.targetUserId as string;

    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      include: { memberships: true },
    });

    const activeHouseholdId = caller?.activeHouseholdId || caller?.householdId;
    if (!activeHouseholdId) {
      return res.status(400).json({ error: "No active household found." });
    }

    const callerMembership = caller.memberships.find(
      (m) => m.householdId === activeHouseholdId,
    );

    if (
      callerMembership?.role !== "HOUSEHOLD_ADMIN" &&
      caller.role !== "HOUSEHOLD_ADMIN"
    ) {
      return res
        .status(403)
        .json({ error: "Only Household Admins can remove members." });
    }

    if (callerId === targetUserId) {
      return res.status(400).json({
        error:
          "Admins cannot remove themselves using this action. Use leave household instead.",
      });
    }

    // 1. Delete from HouseholdMember
    await prisma.householdMember.deleteMany({
      where: {
        userId: targetUserId,
        householdId: activeHouseholdId,
      },
    });

    // 2. If target had this household set as active, detach it or assign their next available household
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { memberships: true },
    });

    if (targetUser?.activeHouseholdId === activeHouseholdId) {
      const nextHousehold = targetUser.memberships[0] || null;
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          activeHouseholdId: nextHousehold?.householdId || null,
          householdId: nextHousehold?.householdId || null,
          role: nextHousehold?.role || "MEMBER",
        },
      });
    }

    return res.json({ message: "Member has been removed from the household." });
  } catch (error) {
    console.error("[Remove Member Error]", error);
    return res.status(500).json({ error: "Failed to remove member." });
  }
});

// 9. LEAVE HOUSEHOLD
router.post("/leave", async (req: Request, res: Response) => {
  try {
    const callerId = req.user!.userId;
    const { successorUserId } = req.body;

    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      include: { memberships: true },
    });

    const activeHouseholdId = caller?.activeHouseholdId || caller?.householdId;
    if (!activeHouseholdId) {
      return res
        .status(400)
        .json({ error: "You are not currently in any household." });
    }

    const household = await prisma.household.findUnique({
      where: { id: activeHouseholdId },
      include: { members: true },
    });

    if (!household) {
      return res.status(404).json({ error: "Household not found." });
    }

    const callerMembership = household.members.find(
      (m) => m.userId === callerId,
    );
    const otherMembers = household.members.filter((m) => m.userId !== callerId);

    // If leaving user is Admin and other flatmates exist, require successor
    if (
      callerMembership?.role === "HOUSEHOLD_ADMIN" &&
      otherMembers.length > 0
    ) {
      if (!successorUserId) {
        return res.status(400).json({
          error:
            "As the Flat Admin, you must appoint a new Admin before leaving.",
          requiresSuccessor: true,
        });
      }

      const successor = otherMembers.find((m) => m.userId === successorUserId);
      if (!successor) {
        return res.status(400).json({
          error: "Designated successor is not a member of this household.",
        });
      }

      await prisma.householdMember.update({
        where: {
          userId_householdId: {
            userId: successorUserId,
            householdId: activeHouseholdId,
          },
        },
        data: { role: "HOUSEHOLD_ADMIN" },
      });
    }

    // Delete membership row for caller
    await prisma.householdMember.deleteMany({
      where: {
        userId: callerId,
        householdId: activeHouseholdId,
      },
    });

    // Pick remaining household if user is in others, else null
    const remainingMemberships = caller.memberships.filter(
      (m) => m.householdId !== activeHouseholdId,
    );
    const nextHousehold = remainingMemberships[0] || null;

    await prisma.user.update({
      where: { id: callerId },
      data: {
        activeHouseholdId: nextHousehold?.householdId || null,
        householdId: nextHousehold?.householdId || null,
        role: nextHousehold?.role || "MEMBER",
      },
    });

    // If household is completely empty, delete it
    if (otherMembers.length === 0) {
      await prisma.household.delete({ where: { id: activeHouseholdId } });
    }

    return res.json({ message: "You have left the household." });
  } catch (error) {
    console.error("[Leave Household Error]", error);
    return res.status(500).json({ error: "Failed to leave household." });
  }
});

// 10. GET ACTIVE HOUSEHOLD DETAILS
router.get("/current", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    const activeHouseholdId = user?.activeHouseholdId || user?.householdId;
    if (!activeHouseholdId) {
      return res
        .status(404)
        .json({ error: "You are not part of any household yet." });
    }

    const household = await prisma.household.findUnique({
      where: { id: activeHouseholdId },
      include: {
        members: {
          include: {
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
