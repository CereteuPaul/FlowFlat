import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import authRouter from "./routes/auth";
import householdRouter from "./routes/household";
import dashboardRouter from "./routes/dashboard";

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

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

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
