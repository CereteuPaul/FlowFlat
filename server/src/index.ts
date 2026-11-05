import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import authRouter from "./routes/auth";
import householdRouter from "./routes/household";
import dashboardRouter from "./routes/dashboard";
import scheduleRouter from "./routes/schedule";
import { sendScheduleReminderEmail } from "./utils/email";

function getOccurrenceInWindow(
  entry: { startTime: Date; recurrence: string; recurrenceEnd: Date | null },
  windowStart: Date,
  windowEnd: Date,
) {
  const cursor = new Date(entry.startTime);
  const recurrenceEnd = entry.recurrenceEnd || windowEnd;
  let guard = 0;

  while (cursor < windowStart && cursor <= recurrenceEnd && guard < 400) {
    if (entry.recurrence === "WEEKLY") cursor.setDate(cursor.getDate() + 7);
    else if (entry.recurrence === "BIWEEKLY") cursor.setDate(cursor.getDate() + 14);
    else if (entry.recurrence === "MONTHLY") cursor.setMonth(cursor.getMonth() + 1);
    else break;
    guard += 1;
  }

  return cursor >= windowStart && cursor < windowEnd && cursor <= recurrenceEnd
    ? cursor
    : null;
}

dotenv.config();

const app = express();
const server = http.createServer(app);
export const prisma = new PrismaClient();

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/households", householdRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/schedule", scheduleRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

async function sendAutomaticScheduleReminders() {
  const now = new Date();
  const windows = [
    { type: "ONE_DAY", start: new Date(now.getTime() + 23 * 60 * 60 * 1000), end: new Date(now.getTime() + 25 * 60 * 60 * 1000) },
    { type: "ONE_HOUR", start: new Date(now.getTime() + 45 * 60 * 1000), end: new Date(now.getTime() + 75 * 60 * 1000) },
  ];

  for (const window of windows) {
    const entries = await prisma.scheduleEntry.findMany({
      where: {
        startTime: { lt: window.end },
        status: { not: "COMPLETED" },
        OR: [
          { recurrence: "ONCE", startTime: { gte: window.start } },
          {
            recurrence: { not: "ONCE" },
            OR: [
              { recurrenceEnd: null },
              { recurrenceEnd: { gte: window.start } },
            ],
          },
        ],
      },
      include: {
        member: { select: { id: true, name: true, email: true } },
      },
    });

    for (const entry of entries) {
      const scheduledFor = getOccurrenceInWindow(
        entry,
        window.start,
        window.end,
      );
      if (!scheduledFor) continue;
      const existing = await prisma.scheduleReminder.findFirst({
        where: {
          scheduleEntryId: entry.id,
          recipientId: entry.memberId,
          reminderType: window.type,
          scheduledFor,
        },
      });
      if (existing) continue;

      await prisma.scheduleReminder.create({
        data: {
          scheduleEntryId: entry.id,
          recipientId: entry.memberId,
          channel: "IN_APP",
          reminderType: window.type,
          scheduledFor,
        },
      });
      await sendScheduleReminderEmail(
        entry.member.email,
        entry.member.name,
        entry.title,
        scheduledFor,
        "FlowFlat",
      );
    }
  }
}

setInterval(() => {
  sendAutomaticScheduleReminders().catch((error) => {
    console.error("[Schedule Automatic Reminder Error]", error);
  });
}, 60_000);

// WebSocket event handlers
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on("join_household", (householdId: string) => {
    socket.join(householdId);
    console.log(`[Socket] Client ${socket.id} joined household ${householdId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 FlowFlat Backend running on http://localhost:${PORT}`);
});
