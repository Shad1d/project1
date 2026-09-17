import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "../models/conversation.js";

/**
 * initSocket(httpServer)
 * ─────────────────────
 * Attaches Socket.IO to the existing HTTP server.
 * Call this in server.js AFTER app and httpServer are created.
 *
 * Usage in server.js:
 *   import { initSocket } from "./socket/index.js";
 *   const io = initSocket(httpServer);
 *   app.set("io", io);          ← so controllers can emit events
 */
export function initSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5173",
            credentials: true,
        },
        // Ping every 25s, disconnect after 60s of no response
        pingInterval: 25000,
        pingTimeout: 60000,
    });

    // ── Auth middleware ───────────────────────────────────────────────────────
    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) return next(new Error("Authentication required."));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Normalize to include `_id` so downstream code can use either
            // `decoded.id` (from auth tokens) or `decoded._id` interchangeably.
            socket.user = { ...decoded, _id: decoded.id ?? decoded._id };
            next();
        } catch {
            next(new Error("Invalid token."));
        }
    });

    // ── Connection handler ────────────────────────────────────────────────────
    io.on("connection", (socket) => {
        const rawUserId = socket.user?.id ?? socket.user?._id ?? socket.user;
        if (!rawUserId) {
            socket.emit("error", { message: "Authentication failed." });
            socket.disconnect(true);
            return;
        }
        const userId = rawUserId.toString();

        // Join a personal room so we can push targeted notifications
        socket.join(`user:${userId}`);

        // ── Join an order chat room ───────────────────────────────────────────
        // Client emits: join_order { orderId }
        socket.on("join_order", async ({ orderId }) => {
            if (!orderId) return;
            try {
                // Verify the user belongs to this conversation
                const convo = await Conversation.findOne({ order: orderId }).select("buyer seller");
                if (!convo) return socket.emit("error", { message: "Conversation not found." });

                const isMember =
                    convo.buyer.toString() === userId ||
                    convo.seller.toString() === userId;

                if (!isMember) return socket.emit("error", { message: "Access denied." });

                socket.join(`order:${orderId}`);

                // Let the other party know this user is online in this chat
                socket.to(`order:${orderId}`).emit("user_online", { userId });
            } catch (err) {
                socket.emit("error", { message: "Failed to join room." });
            }
        });

        // ── Leave order chat room ─────────────────────────────────────────────
        socket.on("leave_order", ({ orderId }) => {
            socket.leave(`order:${orderId}`);
            socket.to(`order:${orderId}`).emit("user_offline", { userId });
        });

        // ── Typing indicators ─────────────────────────────────────────────────
        // Client emits: typing_start { orderId }
        socket.on("typing_start", ({ orderId }) => {
            socket.to(`order:${orderId}`).emit("typing_start", { userId });
        });

        // Client emits: typing_stop { orderId }
        socket.on("typing_stop", ({ orderId }) => {
            socket.to(`order:${orderId}`).emit("typing_stop", { userId });
        });

        // ── Disconnect ────────────────────────────────────────────────────────
        socket.on("disconnect", () => {
            // Broadcast offline to all order rooms this socket was in
            [...socket.rooms].forEach((room) => {
                if (room.startsWith("order:")) {
                    socket.to(room).emit("user_offline", { userId });
                }
            });
        });
    });

    return io;
}