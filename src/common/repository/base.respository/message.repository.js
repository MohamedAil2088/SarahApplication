import { MessageModel } from "../../../DB/model/message.model.js";
import * as baseRepo from "./base.repository.js";

const defaultPopulate = [
    { path: "senderId", select: "firstName lastName email image" },
    { path: "receiverId", select: "firstName lastName email image" }
];

export const createMessage = async ({ data, options } = {}) => {
    return await baseRepo.createOne({ model: MessageModel, data, options });
};

export const findOneMessage = async ({ filter = {}, options = {} } = {}) => {
    return await baseRepo.findOne({
        model: MessageModel,
        filter,
        options: {
            populate: defaultPopulate,
            lean: true,
            ...options
        }
    });
};

export const findMessageById = async ({ id, options = {} } = {}) => {
    return await baseRepo.findById({
        model: MessageModel,
        id,
        options: {
            populate: defaultPopulate,
            lean: true,
            ...options
        }
    });
};

export const paginateMessages = async ({ filter = {}, page, limit, options = {} } = {}) => {
    return await baseRepo.paginate({
        model: MessageModel,
        filter,
        page,
        limit,
        options: {
            sort: { createdAt: -1 },
            populate: defaultPopulate,
            lean: true,
            ...options
        }
    });
};

export const deleteOneMessage = async ({ filter = {} } = {}) => {
    return await baseRepo.deleteOne({ model: MessageModel, filter });
};

