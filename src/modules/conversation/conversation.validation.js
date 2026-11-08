import { z } from "zod";
import { genralValidationFieldes } from "../../common/utils/validation.js";
import { RequestStatusEnum } from "../../enum/index.js";

export const requestIdentity = (lang) => {
    return z.object({
        params: z.object({
            messageId: genralValidationFieldes.id(lang)
        })
    });
};

export const respondToRequest = (lang) => {
    return z.object({
        params: z.object({
            requestId: genralValidationFieldes.id(lang)
        }),
        body: z.object({
            action: z.coerce.number().refine(
                (val) => [RequestStatusEnum.ACCEPTED, RequestStatusEnum.REJECTED].includes(val),
                { message: "Action must be 1 (ACCEPTED) or 2 (REJECTED)" }
            )
        })
    });
};

export const paginationQuery = (lang) => {
    return z.object({
        query: z.object({
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).default(5)
        }).optional()
    });
};

export const sendConversationMessage = (lang) => {
    return z.object({
        params: z.object({
            conversationId: genralValidationFieldes.id(lang)
        }),
        body: z.object({
            content: z.string().min(1).max(50000).optional()
        }),
        files: z.array(genralValidationFieldes.file(lang)).max(3).optional()
    }).superRefine((data, ctx) => {
        if (!data.body?.content && !data.files?.length) {
            ctx.addIssue({
                code: "custom",
                path: ["content"],
                message: "Missing message content"
            });
        }
    });
};

export const getConversationMessages = (lang) => {
    return z.object({
        params: z.object({
            conversationId: genralValidationFieldes.id(lang)
        }),
        query: z.object({
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).default(10)
        }).optional()
    });
};