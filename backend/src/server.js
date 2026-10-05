import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { existsSync } from "node:fs";
import path from "node:path";
import { connectDatabase } from "./config/database.js";
import ticketRoutes from "./routes/ticket.routes.js";
import authRoutes from "./routes/auth.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import portalRoutes from "./routes/portal.routes.js";
import crmRoutes from "./routes/crm.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import sparesRoutes from "./routes/spares.routes.js";
import operationsRoutes from "./routes/operations.routes.js";
import purchasingRoutes from "./routes/purchasing.routes.js";
const app = express();
app.disable("x-powered-by");
/*
|--------------------------------------------------------------------------
| PORT
|--------------------------------------------------------------------------
| Azure provides process.env.PORT automatically.
| Locally, it will use 5000.
*/
const PORT = Number(process.env["PORT"]) || 5000;
/*
|--------------------------------------------------------------------------
| FRONTEND URL
|--------------------------------------------------------------------------
|
| Local:
|   http://localhost:4200
|
| Azure:
|   Set FRONTEND_ORIGIN in Azure Environment Variables.
|
*/
const configuredFrontendOrigins = (process.env["FRONTEND_ORIGIN"] ||
    "http://localhost:4200,https://salmon-wave-09ef6ff10.2.azurestaticapps.net,https://jolly-rock-0ff12e610.5.azurestaticapps.net")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

const corsOrigin = (origin, callback) => {
    // Non-browser clients (for example curl/mobile clients) may not send Origin.
    if (!origin || configuredFrontendOrigins.includes(origin)) {
        callback(null, true);
        return;
    }
    callback(new Error("CORS origin is not allowed."));
};
/*
|--------------------------------------------------------------------------
| Frontend static files
|--------------------------------------------------------------------------
*/
const frontendDirectory = path.resolve(process.cwd(), "public");
const frontendIndex = path.join(frontendDirectory, "index.html");
/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/
app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use(express.json({
    limit: "5mb"
}));
app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});
/*
|--------------------------------------------------------------------------
| ROOT / HEALTH
|--------------------------------------------------------------------------
*/
app.get("/", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "ERP API is running",
        environment: process.env["NODE_ENV"] || "development"
    });
});
app.get("/api/health", (_req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.status(databaseReady ? 200 : 503).json({
        success: databaseReady,
        service: "available",
        database: databaseReady
            ? "connected"
            : "disconnected",
        checkedAt: new Date().toISOString()
    });
});
/*
|--------------------------------------------------------------------------
| API ROUTES
|--------------------------------------------------------------------------
*/
app.use("/api/customers", customerRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/crm", crmRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/spares", sparesRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/purchasing", purchasingRoutes);
/*
|--------------------------------------------------------------------------
| API 404
|--------------------------------------------------------------------------
*/
app.use("/api", (_req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});
/*
|--------------------------------------------------------------------------
| ANGULAR FRONTEND
|--------------------------------------------------------------------------
|
| Only serve Angular files when:
|
| NODE_ENV=production
|
| AND:
|
| public/index.html exists
|
*/
if (process.env["NODE_ENV"] === "production" &&
    existsSync(frontendIndex)) {
    app.use(express.static(frontendDirectory, {
        index: false
    }));
    app.use((req, res, next) => {
        if (req.method !== "GET" &&
            req.method !== "HEAD") {
            next();
            return;
        }
        res.sendFile(frontendIndex);
    });
}
/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/
async function startServer() {
    try {
        await connectDatabase();
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health: /api/health`);
            console.log(`Tickets API: /api/tickets`);
        });
    }
    catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
}
startServer();
