import { Router, Request, Response } from "express";
import { prisma, io } from "../index";
import { authenticate } from "../middleware/auth";
import { sendBillReminderEmail } from "../utils/email";

const router = Router();
router.use(authenticate);

export function resolveChorePriority(
  priority: string,
  dueDate: Date,
): "LOW" | "MEDIUM" | "HIGH" {
  if (priority !== "AUTO") {
    return (
      ["LOW", "MEDIUM", "HIGH"].includes(priority) ? priority : "MEDIUM"
    ) as "LOW" | "MEDIUM" | "HIGH";
  }

  const now = new Date().getTime();
  const target = new Date(dueDate).getTime();
  const diffDays = (target - now) / (1000 * 3600 * 24);

  if (diffDays > 3) {
    return "LOW";
  } else if (diffDays > 1) {
    return "MEDIUM";
  } else {
    return "HIGH"; // Last 24 hours or overdue
  }
}

// 1. GET AGGREGATED DASHBOARD DATA
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user?.householdId) {
      return res.status(404).json({ error: "No active household." });
    }

    const householdId = user.householdId;
    const isRestricted = user.role === "RESTRICTED_MEMBER";

    // Fetch live chores
    const rawChores = await prisma.chore.findMany({
      where: { householdId },
      include: {
        assignedTo: {
          select: { id: true, name: true, avatarColor: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const chores = rawChores.map((c) => ({
      ...c,
      effectivePriority: resolveChorePriority(c.priority, c.dueDate),
    }));

    // Fetch waste routines
    const wasteSchedules = await prisma.wasteSchedule.findMany({
      where: { householdId },
      orderBy: { dayOfWeek: "asc" },
    });

    // Fetch bills (hidden if user is RESTRICTED_MEMBER)
    const bills = isRestricted
      ? []
      : await prisma.bill.findMany({
          where: { householdId },
          include: {
            paidBy: { select: { id: true, name: true } },
            splits: {
              include: { user: { select: { id: true, name: true } } },
            },
          },
          orderBy: { dueDate: "asc" },
        });

    const homeInfos = await prisma.homeInfo.findMany({
      where: { householdId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch live notes (pinned first, then newest)
    const notes = await prisma.note.findMany({
      where: { householdId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    // Calculate real stats
    const totalChores = chores.length;
    const completedChores = chores.filter((c) => {
      if (!c.lastCompletedAt) return false;
      const diffDays =
        (Date.now() - new Date(c.lastCompletedAt).getTime()) /
        (1000 * 3600 * 24);
      return diffDays < c.intervalDays;
    }).length;

    const choreRate =
      totalChores > 0 ? Math.round((completedChores / totalChores) * 100) : 100;

    // Determine upcoming waste collection for today or next days
    const currentDayOfWeek = new Date().getDay();
    const sortedWaste = [...wasteSchedules].sort((a, b) => {
      const diffA = (a.dayOfWeek - currentDayOfWeek + 7) % 7;
      const diffB = (b.dayOfWeek - currentDayOfWeek + 7) % 7;
      return diffA - diffB;
    });
    const nextWaste = sortedWaste[0] || null;

    return res.json({
      chores,
      wasteSchedules,
      bills,
      homeInfos,
      notes,
      stats: {
        totalChores,
        completedChores,
        choreRate,
        pendingTasksCount: totalChores - completedChores + (nextWaste ? 1 : 0),
        nextWaste,
      },
    });
  } catch (error) {
    console.error("[Dashboard Summary Error]", error);
    return res.status(500).json({ error: "Failed to retrieve summary." });
  }
});

// CREATE NOTE
router.post("/notes", async (req: Request, res: Response) => {
  try {
    const {
      title,
      category = "SHOPPING",
      content,
      items,
      isPinned = false,
    } = req.body;
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!caller?.householdId) {
      return res.status(400).json({ error: "No active household." });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Note title is required." });
    }

    const note = await prisma.note.create({
      data: {
        householdId: caller.householdId,
        title: title.trim(),
        category,
        content: content ? content.trim() : null,
        items: items || [],
        isPinned: Boolean(isPinned),
        createdById: caller.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ note });
  } catch (error) {
    console.error("[Create Note Error]", error);
    return res.status(500).json({ error: "Failed to create note." });
  }
});

// TOGGLE ITEM IN NOTE CHECKLIST
router.patch("/notes/:id/toggle-item", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { itemId } = req.body;

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) return res.status(404).json({ error: "Note not found." });

    const currentItems = (note.items as any[]) || [];
    const updatedItems = currentItems.map((item) =>
      item.id === itemId ? { ...item, isChecked: !item.isChecked } : item,
    );

    const updated = await prisma.note.update({
      where: { id },
      data: { items: updatedItems },
    });

    return res.json({ note: updated });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle checklist item." });
  }
});

// TOGGLE PIN NOTE
router.patch("/notes/:id/pin", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) return res.status(404).json({ error: "Note not found." });

    const updated = await prisma.note.update({
      where: { id },
      data: { isPinned: !note.isPinned },
    });

    return res.json({ note: updated });
  } catch (error) {
    return res.status(500).json({ error: "Failed to pin/unpin note." });
  }
});

// DELETE NOTE
router.delete("/notes/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.note.delete({ where: { id } });
    return res.json({ message: "Note deleted." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete note." });
  }
});

// CREATE HOME INFO (ADMIN ONLY)
router.post("/home-info", async (req: Request, res: Response) => {
  try {
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });
    if (!caller?.householdId) {
      return res.status(400).json({ error: "No active household." });
    }

    if (caller.role !== "HOUSEHOLD_ADMIN" && caller.role !== "PLATFORM_ADMIN") {
      return res
        .status(403)
        .json({ error: "Only Household Admins can create Home Info." });
    }

    const { title, category = "APARTMENT", content, secretValue } = req.body;
    if (!title || !content) {
      return res
        .status(400)
        .json({ error: "Title and content description are required." });
    }

    const info = await prisma.homeInfo.create({
      data: {
        householdId: caller.householdId,
        title: title.trim(),
        category,
        content: content.trim(),
        secretValue: secretValue ? secretValue.trim() : null,
        createdById: caller.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ info });
  } catch (error) {
    console.error("[Create Home Info Error]", error);
    return res.status(500).json({ error: "Failed to create Home Info item." });
  }
});

// DELETE WASTE ROUTINE
router.delete("/waste/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    const schedule = await prisma.wasteSchedule.findUnique({ where: { id } });
    if (!schedule || schedule.householdId !== caller?.householdId) {
      return res.status(404).json({ error: "Waste schedule not found." });
    }

    await prisma.wasteSchedule.delete({ where: { id } });
    return res.json({ message: "Waste schedule deleted successfully." });
  } catch (error) {
    console.error("[Delete Waste Error]", error);
    return res.status(500).json({ error: "Failed to delete waste schedule." });
  }
});

// DELETE HOME INFO (ADMIN ONLY)
router.delete("/home-info/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (
      caller?.role !== "HOUSEHOLD_ADMIN" &&
      caller?.role !== "PLATFORM_ADMIN"
    ) {
      return res
        .status(403)
        .json({ error: "Only Household Admins can delete Home Info." });
    }

    await prisma.homeInfo.delete({ where: { id } });
    return res.json({ message: "Home info entry deleted." });
  } catch (error) {
    console.error("[Delete Home Info Error]", error);
    return res.status(500).json({ error: "Failed to delete entry." });
  }
});

// CREATE CHORE WITH RICH DETAILS
router.post("/chores", async (req: Request, res: Response) => {
  try {
    const { title, assignedToId, dueDate, notes, priority = "AUTO" } = req.body;
    const callerId = req.user!.userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });

    if (!title || !assignedToId || !caller?.householdId) {
      return res
        .status(400)
        .json({ error: "Title and assignee are required." });
    }

    // Parse chosen target date (set to 23:59:59 of that day to avoid timezone cutoff)
    let choreDueDate: Date;
    if (dueDate) {
      const [y, m, d] = dueDate.split("-").map(Number);
      choreDueDate = new Date(y, m - 1, d, 23, 59, 59);
    } else {
      choreDueDate = new Date(Date.now() + 4 * 24 * 3600 * 1000);
    }

    const chore = await prisma.chore.create({
      data: {
        householdId: caller.householdId,
        title: title.trim(),
        assignedToId,
        createdById: caller.id,
        notes: notes ? notes.trim() : null,
        priority: ["AUTO", "LOW", "MEDIUM", "HIGH"].includes(priority)
          ? priority
          : "AUTO",
        dueDate: choreDueDate,
        rotationUserIds: [assignedToId],
      },
      include: {
        assignedTo: { select: { id: true, name: true, avatarColor: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    io.to(caller.householdId).emit("data_updated");
    return res.status(201).json({ chore });
  } catch (error) {
    console.error("[Create Chore Error]", error);
    return res.status(500).json({ error: "Failed to create chore." });
  }
});

// DELETE CHORE
router.delete("/chores/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.chore.delete({ where: { id } });
    return res.json({ message: "Chore deleted successfully." });
  } catch (error) {
    console.error("[Delete Chore Error]", error);
    return res.status(500).json({ error: "Failed to delete chore." });
  }
});

// 3. TOGGLE CHORE COMPLETION
router.patch("/chores/:id/toggle", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const chore = await prisma.chore.findUnique({ where: { id } });

    if (!chore) {
      return res.status(404).json({ error: "Chore not found." });
    }

    // Toggle: if it has a completion date, reset it to null. If null, set to now.
    const updated = await prisma.chore.update({
      where: { id },
      data: {
        lastCompletedAt: chore.lastCompletedAt ? null : new Date(),
      },
      include: {
        assignedTo: { select: { id: true, name: true, avatarColor: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return res.json({ chore: updated });
  } catch (error) {
    console.error("[Toggle Chore Error]", error);
    return res.status(500).json({ error: "Failed to update chore status." });
  }
});

// 4. CREATE WASTE ROUTINE
router.post("/waste", async (req: Request, res: Response) => {
  try {
    const {
      wasteType,
      colorTag = "#EAB308",
      dayOfWeek,
      frequency = "WEEKLY",
    } = req.body;
    const caller = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!wasteType || dayOfWeek === undefined || !caller?.householdId) {
      return res
        .status(400)
        .json({ error: "Waste type and collection day are required." });
    }

    const schedule = await prisma.wasteSchedule.create({
      data: {
        householdId: caller.householdId,
        wasteType: wasteType.trim(),
        colorTag,
        dayOfWeek: Number(dayOfWeek),
        frequency,
      },
    });

    return res.status(201).json({ schedule });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create waste routine." });
  }
});

// 5. MARK WASTE AS PUT OUT
router.patch("/waste/:id/put-out", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updated = await prisma.wasteSchedule.update({
      where: { id },
      data: { lastPutOut: new Date() },
    });
    return res.json({ schedule: updated });
  } catch (error) {
    return res.status(500).json({ error: "Failed to mark waste as put out." });
  }
});

// 6. CREATE BILL & AUTOMATICALLY SPLIT ACROSS FULL MEMBERS
router.post("/bills", async (req: Request, res: Response) => {
  try {
    const {
      title,
      amount,
      currency = "EUR",
      isRecurring = false,
      recurrence = "ONE_TIME",
      billDate,
      dueDate,
      selectedUserIds,
    } = req.body;

    const callerId = req.user!.userId;
    const caller = await prisma.user.findUnique({
      where: { id: callerId },
      include: {
        activeHousehold: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
      },
    });
    if (!title || !amount || !caller?.householdId) {
      return res
        .status(400)
        .json({ error: "Title, amount, and active household required." });
    }

    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number." });
    }

    // Determine target members to split between
    const validUserIds: string[] =
      Array.isArray(selectedUserIds) && selectedUserIds.length > 0
        ? selectedUserIds
        : caller?.activeHousehold?.members.map((m) => m.userId) || [callerId];

    const splitAmount = parseFloat(
      (totalAmount / validUserIds.length).toFixed(2),
    );
    const parsedBillDate = billDate ? new Date(billDate) : new Date();
    const parsedDueDate = dueDate
      ? new Date(dueDate)
      : new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const bill = await prisma.bill.create({
      data: {
        householdId: caller.householdId,
        title: title.trim(),
        amount: totalAmount,
        currency,
        isRecurring: Boolean(isRecurring),
        recurrence: isRecurring ? recurrence : "ONE_TIME",
        billDate: parsedBillDate,
        dueDate: parsedDueDate,
        paidById: caller.id,
        isSettled: false,
        splits: {
          create: validUserIds.map((userId) => ({
            userId,
            amountOwed: splitAmount,
            isPaid: userId === callerId, // Mark payer's own share as settled
          })),
        },
      },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // Check if fully settled immediately
    const allPaid = bill.splits.every((s) => s.isPaid);
    if (allPaid) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { isSettled: true },
      });
    }

    io.to(caller.householdId).emit("data_updated");
    return res.status(201).json({ bill });
  } catch (error) {
    console.error("[Create Bill Error]", error);
    return res.status(500).json({ error: "Failed to create bill." });
  }
});

// SEND REMINDER FOR UNPAID SPLITS
router.post("/bills/:id/remind", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        paidBy: { select: { id: true, name: true } },
        splits: { where: { isPaid: false }, include: { user: true } },
      },
    });

    if (!bill) return res.status(404).json({ error: "Bill not found." });

    const unpaidCount = bill.splits.length;
    if (unpaidCount === 0) {
      return res
        .status(400)
        .json({ error: "All splits are already marked paid." });
    }

    const updated = await prisma.bill.update({
      where: { id },
      data: { lastRemindedAt: new Date() },
    });

    // Send email reminders to unpaid members
    for (const split of bill.splits) {
      if (split.user.email) {
        await sendBillReminderEmail(
          split.user.email,
          split.user.name,
          bill.title,
          split.amountOwed,
          new Date(bill.dueDate).toLocaleDateString(),
        );
      }
    }

    // Emit live alert to the household channel
    io.to(bill.householdId).emit("bill_reminder", {
      billTitle: bill.title,
      sender: bill.paidBy.name,
      unpaidMembers: bill.splits.map((s) => s.user.name),
    });

    return res.json({
      message: `Reminder sent to ${unpaidCount} roommate(s).`,
      bill: updated,
    });
  } catch (error) {
    console.error("[Bill Reminder Error]", error);
    return res.status(500).json({ error: "Failed to send reminder." });
  }
});

// TOGGLE SPLIT PAYMENT STATUS
router.patch(
  "/bills/splits/:splitId/toggle",
  async (req: Request, res: Response) => {
    try {
      const splitId = req.params.splitId as string;
      const split = await prisma.billSplit.findUnique({
        where: { id: splitId },
        include: { bill: { include: { splits: true } } },
      });

      if (!split)
        return res.status(404).json({ error: "Split record not found." });

      const updatedSplit = await prisma.billSplit.update({
        where: { id: splitId },
        data: { isPaid: !split.isPaid },
      });

      // Recheck if all splits on the parent bill are now settled
      const allSplits = await prisma.billSplit.findMany({
        where: { billId: split.billId },
      });
      const allPaid = allSplits.every((s) => s.isPaid);

      await prisma.bill.update({
        where: { id: split.billId },
        data: { isSettled: allPaid },
      });

      io.to(split.bill.householdId).emit("data_updated");
      return res.json({ split: updatedSplit });
    } catch (error) {
      return res.status(500).json({ error: "Failed to toggle split." });
    }
  },
);

// DELETE BILL
router.delete("/bills/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.bill.delete({ where: { id } });
    return res.json({ message: "Bill removed." });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete bill." });
  }
});

export default router;
