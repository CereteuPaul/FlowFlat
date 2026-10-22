import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const server = http.createServer(app);
export const prisma = new PrismaClient();

// Setup WebSocket server with permissive CORS for development
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Basic health check route
app.get("/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// WebSocket event handlers
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join a dedicated room for a specific household
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
