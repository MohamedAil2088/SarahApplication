import { BadRequestException } from "../common/exceptions/error.exceptions.js";

export const Validation = (schema) => {
    return (req, res, next) => {
        const language = req.lang;
        const validationResult = schema(language).safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
            headers: req.headers,
            file: req.file,
            files: req.files
        })
            if (!validationResult.success) {
                throw BadRequestException("Validation Error", validationResult.error.issues);
            }
            req.validate = validationResult.data
            next()
    }
}