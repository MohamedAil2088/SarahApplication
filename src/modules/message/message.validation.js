import { file, z } from "zod";
import { genralValidationFieldes } from "../../common/utils/validation.js";
import { MessageTypeEnum } from "../../enum/index.js";

export const creatMessage = (lang) => {
    return z.object({
        params: z.object({
            userId: genralValidationFieldes.id(lang).optional()
        }).optional(),
        body: z.object({
            content: z.string().min(2).max(50000).optional(),
            receiverId: genralValidationFieldes.id(lang).optional()
        }),
        files: z.array(genralValidationFieldes.file(lang)).max(3).optional()
    }).superRefine((data, ctx) => {
        if (!data.params?.userId && !data.body?.receiverId) {
            ctx.addIssue({
                code: "custom",
                path: ['receiverId'],
                message: "Missing receiver Id"
            });
        }
        if (!data.body.content && !data.files?.length) {
            ctx.addIssue({
                code: "custom",
                path: ['content'],
                message: "Missing message content"
            });
        }
    });
};

export const deleteMessage = (lang) => {
    return z.object({
        params: z.object({
            messageId: genralValidationFieldes.id(lang)
        })
    })

}

export const getMessage = (lang) => {
    return z.object({
        params: z.object({
            messageId: genralValidationFieldes.id(lang)
        })
    })

}

export const getAllMessage = (lang) => {
    return z.object({
        query: z.object({
            type: z.enum(Object.values(MessageTypeEnum)).optional(),
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).default(5)
        }).optional()
    });
};