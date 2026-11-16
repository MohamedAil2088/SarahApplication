import { Router } from "express";
import { successResponse } from "../../common/utils/success.respons.js";
import { Validation } from "../../middleware/validation.middleware.js";
import { authentication } from "../../middleware/authentication.middleware.js";
import { uploadMiddleware } from "../../middleware/multer.middleware.js";
import { fileValidation, localFileUpload } from "../../common/utils/index.js";
import * as service from "./conversation.service.js";
import * as validators from "./conversation.validation.js";

const router = Router();
const chatFolderName = "chat";

router.post(
    "/request-identity/:messageId",
    authentication(),
    Validation(validators.requestIdentity),
    async (req, res) => {
        const data = await service.requestSenderIdentity(req.params, req.user);
        return successResponse({ res, status: 201, message: "Identity request sent successfully", data });
    }
);

router.get(
    "/requests",
    authentication(),
    Validation(validators.paginationQuery),
    async (req, res) => {
        const data = await service.getReceivedIdentityRequests(req.query, req.user);
        return successResponse({ res, data });
    }
);

router.patch(
    "/request/:requestId",
    authentication(),
    Validation(validators.respondToRequest),
    async (req, res) => {
        const data = await service.respondToIdentityRequest(
            { requestId: req.params.requestId, action: req.validate.body.action },
            req.user
        );
        return successResponse({ res, data });
    }
);

router.get(
    "/",
    authentication(),
    Validation(validators.paginationQuery),
    async (req, res) => {
        const data = await service.getConversations(req.query, req.user);
        return successResponse({ res, data });
    }
);

router.post(
    "/:conversationId/messages",
    authentication(),
    uploadMiddleware({
        multerMiddleware: localFileUpload().array("attachments", 3),
        validation: fileValidation.Image,
        customPath: chatFolderName,
        isRequired: false
    }),
    Validation(validators.sendConversationMessage),
    async (req, res) => {
        const data = await service.sendConversationMessage(
            { conversationId: req.params.conversationId, content: req.body.content },
            req.files,
            req.user
        );
        return successResponse({ res, status: 201, message: "Message sent successfully", data });
    }
);

router.get(
    "/:conversationId/messages",
    authentication(),
    Validation(validators.getConversationMessages),
    async (req, res) => {
        const data = await service.getConversationMessages(
            { conversationId: req.params.conversationId, ...req.query },
            req.user
        );
        return successResponse({ res, data });
    }
);

export default router;