import { Router } from "express";
import { creatMessage, deleteMessage, getAllMessage, getMessage } from "./message.service.js";
import { successResponse } from "../../common/utils/success.respons.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileValidation, localFileUpload } from "../../common/utils/index.js";
import * as validators from "./message.validation.js"
import { Validation } from "../../middleware/validation.middleware.js";
import { bearerAuth } from "../../middleware/authentication.middleware.js";
const router = Router({ mergeParams: true });
const messageFolderName = "message"
router.post(
    "/",
    async (req, res, next) => {

        if (req.headers['authorization']) {
            await bearerAuth({ req })
        }
        next()
    },
    uploadMiddleware({
        multerMiddleware: localFileUpload().any("attachments", 3),
        validation: fileValidation.Image,
        customPath: messageFolderName,
        isRequired: false
    }),
    Validation(validators.creatMessage),
    async (req, res) => {
        const receiverId = req.params.userId || req.body.receiverId;
        const data = await creatMessage({ ...req.body, receiverId }, req.files, req.user);
        return successResponse({ res, status: 201, data });
    })
router.get(
    "/",
    async (req, res, next) => {
        await bearerAuth({ req })
        next()
    },
    Validation(validators.getAllMessage),
    async (req,res) =>{
        const data = await getAllMessage(req.query, req.user);
        return successResponse({res, data})
    }
)

router.delete(
    "/:messageId",
    async (req, res, next) => {
        await bearerAuth({ req })
        next()
    },
    Validation(validators.deleteMessage),
    async (req,res) =>{
        const data = await deleteMessage(req.params, req.user);
        return successResponse({res, data})
    }
)
router.get(
    "/:messageId",
    async (req, res, next) => {
        await bearerAuth({ req });
        next();
    },
    Validation(validators.getMessage),
    async (req, res) => {
        const data = await getMessage(req.params, req.user);
        return successResponse({ res, data });
    }
);



export default router;
