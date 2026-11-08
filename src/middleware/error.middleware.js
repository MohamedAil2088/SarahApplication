import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { NODE_ENV } from "../config.js";

export const globalErrorHandling = async (error, req, res, next) => {
    if (req?.savedFiles?.length) {
        for (const filePath of req.savedFiles) {
            await unlink(resolve(`./${filePath}`)).catch(() => { });
        }
    }
    const isDev = NODE_ENV === "development";
    return res.status(error.cause?.status ?? 500).json({
        error_message: error.message || 'server error',
        issues: error.cause?.issues,
        stack: NODE_ENV == "production"? undefined : error.stack,
        ...(isDev ? { error, cause: error.cause, stack: error.stack } : {})
    });
};
