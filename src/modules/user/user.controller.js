import { Router } from "express";
import { successResponse } from "../../common/utils/index.js";
import { logout, profile, rotateToken, update } from "./user.service.js";
import { authentication, authorization } from "../../middleware/authentication.middleware.js";
import { TokenTypeEnum } from "../../enum/security.enum.js";
import { RoleEnum } from "../../enum/user.gender.js";
import { fileValidation, localFileUpload } from "../../common/utils/multer/local.multer.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { BadRequestException } from "../../common/exceptions/error.exceptions.js";
import * as validators from "./user.validation.js";
import messageController from "../message/message.controller.js";

const router = Router();

router.use("/:userId/message", messageController);

router.patch("/profile-image",
    authentication(),
    uploadMiddleware({
        isRequired: true,
        multerMiddleware: localFileUpload({ maxFileSize: 2 }).single("attachment"),
        customPath: "users",
        validation: fileValidation.Image,
    }),
    async (req, res, next) => {
        if (!req.file?.path) {
            throw BadRequestException("Profile image is required");
        }
        req.user.image = req.file.path;
        await req.user.save();
        const user = req.user.toObject ? req.user.toObject() : { ...req.user };
        delete user.password;
        return successResponse({ res, data: { user } });
    });

router.get("/", authentication(), async (req, res, next) => {
    const data = await profile(req.user)
    return successResponse({ res, data });
});
router.patch("/", authentication(), authorization(RoleEnum.USER), Validation(validators.updateUser), async (req, res, next) => {
    const data = await update(req.user, req.validate?.body || req.body);
    return successResponse({ res, data });
});

router.post("/rotate-token", authentication(TokenTypeEnum.RFRESH), async (req, res, next) => {
    const data = await rotateToken(req.payload, req.user, `${req.protocol}://${req.host}`)
    return successResponse({ res, data });
});

router.post("/logout", authentication(), async (req, res, next) => {
    const data = await logout(req.payload, req.user, req.body)
    return successResponse({ res, data });
});
export default router;
