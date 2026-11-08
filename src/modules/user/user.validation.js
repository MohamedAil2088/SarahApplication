import { z } from "zod";
import { genralValidationFieldes } from "../../common/utils/validation.js";

export const updateUser = (language) => {
    return z.object({
        body: z.object({
            username: genralValidationFieldes.username(language).optional(),
            firstName: z.string().min(2).max(25).optional(),
            lastName: z.string().min(2).max(25).optional(),
            phone: genralValidationFieldes.phone(language).optional(),
            DOB: genralValidationFieldes.DOB(language).optional(),
            gender: genralValidationFieldes.gender(language).optional()
        }).strict()
    });
};

