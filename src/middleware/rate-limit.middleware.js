import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import geoip from "geoip-lite";
import { client } from "../DB/redis.connection.js";
import { successResponse } from "../common/utils/success.respons.js";

export function fromWhere(ip) {
    if (!ip || ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1") {
        return { country: "EG" };
    }
    return geoip.lookup(ip) || { country: "UNKNOWN" };
}

export const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    limit: function (req) {
        const data = fromWhere(req.ip);
        return data?.country === "EG" ? 3 : 0;
    },
    statusCode: 429,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: true, // Graceful degradation: let requests pass if Redis temporarily fails
    store: new RedisStore({
        sendCommand: (...args) => client.sendCommand(args),
        prefix: "rl:"
    }),
    handler: function (req, res, next) {
        return successResponse({ res, message: "Too Many Requests", status: 429 });
    },
    keyGenerator: function (req) {
        const rawIp = req.ip || "127.0.0.1";
        const ip = ipKeyGenerator(rawIp, 52) || rawIp;
        return `${ip}::${req.baseUrl || ''}${req.path}`;
    }
});
