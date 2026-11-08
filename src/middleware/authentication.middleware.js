import { ForbiddenExecuption, UnauthorizedException } from "../common/exceptions/error.exceptions.js"
import { BadRequestException } from "../common/exceptions/error.exceptions.js"
import { basicAuth, decodeToken } from "../common/security/token.security.js"
import { TokenTypeEnum } from "../enum/security.enum.js"

export const bearerAuth = async ({ req, tokenType = TokenTypeEnum.ACCESS } = {}) => {
    const [key, credential] = req.headers['authorization']?.split(" ") || []
    if (!credential) {
        throw UnauthorizedException("Missing or invalid authorization token");
    }
    const { user, payload } = await decodeToken({ authorization: credential, tokenType })
    req.user = user
    req.payload = payload
}

export const authentication = (tokenType = TokenTypeEnum.ACCESS) => {
    return async (req, res, next) => {
        const { authorization } = req.headers

        if (!authorization) {
            throw UnauthorizedException("Unauthorized Account")
        }
        const [key, credential] = authorization.split(" ") || []
        switch (key) {
            case "Basic":
                if (!credential) {
                    return next(UnauthorizedException("Missing basic credentials"));
                }
                const [email, password] = Buffer.from(credential, "base64").toString("utf-8").split(":");
                req.user = await basicAuth({ email, password });
                break;
            case "Bearer":
                const { user, payload } = await decodeToken({ authorization: credential, tokenType })
                req.user = user
                req.payload = payload
                break;
            default:
                return next(BadRequestException("Invalid authentication schema"));
        }

        return next()
    }
}

export const authorization = (accessRole) => {
    return async (req, res, next) => {
        if (req.user.role < accessRole) {
            throw ForbiddenExecuption("Forbidden Account")
        }
        // if (!accessRole.includes(req.user.role)) {
        //     throw ForbiddenExecuption("Forbidden Account")
        // }
        next()
    }
}