import { ForbiddenExecuption, UnauthorizedException } from "../common/exceptions/error.exceptions.js"
import { decodeToken } from "../common/security/token.security.js"
import { TokenTypeEnum } from "../enum/security.enum.js"

export const bearerAuth = async ({ req, tokenType = TokenTypeEnum.ACCESS } = {}) => {
    const [key, credential] = req.headers['authorization']?.split(" ") || []
    if (key !== "Bearer" || !credential) {
        throw UnauthorizedException("Missing or invalid authorization token");
    }
    const { user, payload } = await decodeToken({ authorization: credential, tokenType })
    req.user = user
    req.payload = payload
}

export const authentication = (tokenType = TokenTypeEnum.ACCESS) => {
    return async (req, res, next) => {
        await bearerAuth({ req, tokenType });
        return next();
    };
};

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
