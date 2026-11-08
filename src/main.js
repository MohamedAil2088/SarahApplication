import './config.js';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { NODE_ENV, PORT, WHITELIST } from './config.js';
import { authenticationController, conversationController, messageController, userController } from './modules/index.js';
import { globalErrorHandling, limiter } from './middleware/index.js';
import { bootstrapDB } from './DB/model/connection.db.js';
import { languageMiddleware } from './middleware/language.middleware.js';
import helmet from "helmet";
import hpp from "hpp";
import mongoose from "mongoose";
import { client } from "./DB/redis.connection.js";

const app = express();
app.set("trust proxy", 1);
const port = PORT;

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || WHITELIST.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
};

const server = await bootstrapDB(app, port);

app.use(helmet());
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(cors(corsOptions));
app.use(express.json({ limit: "50kb" }));
app.use(hpp());
app.use("/assets", express.static("./assets"));
app.use(languageMiddleware);
app.use(limiter);

app.all("/", (req, res) => res.status(200).send({ message: "Welcome to BE API 🔥" }));

app.use("/conversation", conversationController);
app.use("/auth", authenticationController);
app.use("/message", messageController);
app.use("/user", userController);

app.all("/{*dummy}", (req, res) => res.status(404).send({ message: "Invalid application routing" }));

app.use(globalErrorHandling);

// Graceful Shutdown Handler (Production Resilience)
const handleGracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    if (server) {
        server.close(async () => {
            console.log("🔒 HTTP server closed. In-flight requests finished.");
            try {
                await mongoose.connection.close(false);
                console.log("📦 MongoDB connection cleanly closed.");
                await client.quit();
                console.log("⚡ Redis connection cleanly closed.");
                process.exit(0);
            } catch (err) {
                console.error("Error during graceful shutdown:", err);
                process.exit(1);
            }
        });
        setTimeout(() => {
            console.error("⚠️ Forcefully shutting down after timeout.");
            process.exit(1);
        }, 10000).unref();
    } else {
        process.exit(0);
    }
};

process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));
process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
