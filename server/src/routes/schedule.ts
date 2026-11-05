import { Router, Request, Response } from "express";
import { prisma } from "../index";
import { authenticate } from "../middleware/auth";
import { sendScheduleReminderEmail } from "../utils/email";

const router = Router();
router.use(authenticate);

const RECURRENCES = new Set(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY"]);
const STATUSES = new Set(["PENDING", "IN_PROGRESS", "COMPLETED"]);
const routeParam = (value: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

async function getCaller(req: Request) {
  return prisma.user.findUnique({
    where: { id: req.user!.userId },
    include: { memberships: true },
  });
}

function isAdmin(caller: Awaited<ReturnType<typeof getCaller>>) {
  return caller?.memberships.some(
    (membership) =>
      membership.householdId === caller.activeHouseholdId &&
      membership.role === "HOUSEHOLD_ADMIN",
  );
}

function activeHouseholdId(caller: Awaited<ReturnType<typeof getCaller>>) {
  return caller?.activeHouseholdId || caller?.householdId || null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const caller = await getCaller(req);
    const householdId = activeHouseholdId(caller);
    if (!householdId) {
      return res.status(400).json({ error: "No active household." });
    }

    const entries = await prisma.scheduleEntry.findMany({
      where: { householdId },
      include: {
        member: { select: { id: true, name: true, email: true, avatarColor: true } },
        chore: { select: { id: true, title: true, assignedToId: true, lastCompletedAt: true } },
      },
      orderBy: { startTime: "asc" },
    });

    const reminders = await prisma.scheduleReminder.findMany({
      where: { recipientId: caller!.id, readAt: null },
      include: {
        scheduleEntry: { select: { id: true, title: true, startTime: true, memberId: true } },
        sender: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ entries, reminders });
  } catch (error) {
    console.error("[Schedule List Error]", error);
    return res.status(500).json({ error: "Failed to retrieve schedule." });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const caller = await getCaller(req);
    const householdId = activeHouseholdId(caller);
    const {
      memberId = caller?.id,
      type = "AVAILABILITY",
      title,
      notes,
      location,
      availability,
      startTime,
      endTime,
      recurrence = "ONCE",
      recurrenceEnd,
      choreId,
    } = req.body;

    if (!householdId || !caller) {
      return res.status(400).json({ error: "No active household." });
    }
    if (!title?.trim() || !startTime || !endTime) {
      return res.status(400).json({ error: "Title, start time, and end time are required." });
    }
    if (!RECURRENCES.has(recurrence)) {
      return res.status(400).json({ error: "Invalid recurrence option." });
    }
    if (new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({ error: "End time must be after start time." });
    }
    if (memberId !== caller.id && !isAdmin(caller)) {
      return res.status(403).json({ error: "Only household admins may schedule entries for another member." });
    }

    const membership = await prisma.householdMember.findUnique({
      where: { userId_householdId: { userId: memberId, householdId } },
    });
    if (!membership) {
      return res.status(400).json({ error: "The selected member is not in this household." });
    }

    let linkedChoreId: string | null = null;
    if (choreId) {
      const chore = await prisma.chore.findFirst({
        where: { id: choreId, householdId },
      });
      if (!chore) {
        return res.status(400).json({ error: "The selected chore was not found." });
      }
      linkedChoreId = chore.id;
    }

    const entry = await prisma.scheduleEntry.create({
      data: {
        householdId,
        memberId,
        createdById: caller.id,
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        location: location?.trim() || null,
        availability: type === "AVAILABILITY" ? availability || "AVAILABLE" : null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        recurrence,
        recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
        choreId: linkedChoreId,
      },
      include: {
        member: { select: { id: true, name: true, email: true, avatarColor: true } },
        chore: { select: { id: true, title: true, assignedToId: true, lastCompletedAt: true } },
      },
    });

    return res.status(201).json({ entry });
  } catch (error) {
    console.error("[Schedule Create Error]", error);
    return res.status(500).json({ error: "Failed to create schedule entry." });
  }
});

router.post("/from-chore/:choreId", async (req: Request, res: Response) => {
  try {
    const choreId = routeParam(req.params.choreId);
    const caller = await getCaller(req);
    const householdId = activeHouseholdId(caller);
    const chore = householdId
      ? await prisma.chore.findFirst({
          where: { id: choreId, householdId },
        })
      : null;
    if (!caller || !householdId || !chore) {
      return res.status(404).json({ error: "Chore not found." });
    }

    const existing = await prisma.scheduleEntry.findFirst({
      where: { choreId: chore.id },
    });
    if (existing) {
      return res.status(409).json({ error: "This chore is already on the schedule." });
    }

    const endTime = new Date(chore.dueDate);
    endTime.setHours(endTime.getHours() + 1);
    const entry = await prisma.scheduleEntry.create({
      data: {
        householdId,
        memberId: chore.assignedToId,
        createdById: caller.id,
        type: "CHORE",
        title: chore.title,
        notes: chore.notes,
        startTime: chore.dueDate,
        endTime,
        recurrence: chore.intervalDays === 14 ? "BIWEEKLY" : chore.intervalDays >= 28 ? "MONTHLY" : "WEEKLY",
        choreId: chore.id,
      },
      include: {
        member: { select: { id: true, name: true, email: true, avatarColor: true } },
        chore: { select: { id: true, title: true, assignedToId: true, lastCompletedAt: true } },
      },
    });
    return res.status(201).json({ entry });
  } catch (error) {
    console.error("[Schedule Chore Link Error]", error);
    return res.status(500).json({ error: "Failed to add chore to schedule." });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const entryId = routeParam(req.params.id);
    const caller = await getCaller(req);
    const entry = await prisma.scheduleEntry.findUnique({ where: { id: entryId } });
    if (!caller || !entry) return res.status(404).json({ error: "Schedule entry not found." });
    if (entry.memberId !== caller.id && !isAdmin(caller)) {
      return res.status(403).json({ error: "You may only update your own schedule status." });
    }
    if (!STATUSES.has(req.body.status)) {
      return res.status(400).json({ error: "Invalid schedule status." });
    }
    const updated = await prisma.scheduleEntry.update({
      where: { id: entry.id },
      data: { status: req.body.status },
    });
    return res.json({ entry: updated });
  } catch (error) {
    console.error("[Schedule Status Error]", error);
    return res.status(500).json({ error: "Failed to update schedule status." });
  }
});

router.post("/:id/remind", async (req: Request, res: Response) => {
  try {
    const entryId = routeParam(req.params.id);
    const caller = await getCaller(req);
    const householdId = activeHouseholdId(caller);
    const entry = await prisma.scheduleEntry.findFirst({
      where: { id: entryId, householdId: householdId || undefined },
      include: { member: true },
    });
    if (!caller || !entry) return res.status(404).json({ error: "Schedule entry not found." });
    if (entry.memberId === caller.id) {
      return res.status(400).json({ error: "You cannot remind yourself." });
    }

    const reminder = await prisma.scheduleReminder.create({
      data: {
        scheduleEntryId: entry.id,
        recipientId: entry.memberId,
        senderId: caller.id,
        channel: "IN_APP",
        reminderType: "MANUAL",
      },
    });
    const email = await sendScheduleReminderEmail(
      entry.member.email,
      entry.member.name,
      entry.title,
      entry.startTime,
      caller.name,
    );
    return res.json({ reminder, emailSent: email.success });
  } catch (error) {
    console.error("[Schedule Reminder Error]", error);
    return res.status(500).json({ error: "Failed to send schedule reminder." });
  }
});

router.patch("/reminders/:id/read", async (req: Request, res: Response) => {
  try {
    const reminderId = routeParam(req.params.id);
    await prisma.scheduleReminder.updateMany({
      where: { id: reminderId, recipientId: req.user!.userId },
      data: { readAt: new Date() },
    });
    return res.json({ message: "Reminder marked as read." });
  } catch (error) {
    console.error("[Schedule Reminder Read Error]", error);
    return res.status(500).json({ error: "Failed to update reminder." });
  }
});

export default router;
