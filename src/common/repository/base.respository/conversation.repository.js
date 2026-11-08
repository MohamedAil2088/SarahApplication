import {
    IdentityRequestModel,
    ConversationModel,
    ConversationMessageModel
} from "../../../DB/model/index.js";
import * as baseRepo from "./base.repository.js";


const defaultRequestPopulate = [
    { path: "messageId", select: "content attachments createdAt" },
    { path: "requesterId", select: "firstName lastName image" },
    { path: "targetSenderId", select: "firstName lastName image" }
];

const defaultConversationPopulate = [
    { path: "participants", select: "firstName lastName image" },
    { path: "originalMessageId", select: "content attachments createdAt" },
    { path: "lastMessage", select: "content senderId attachments createdAt" }
];

const defaultMessagePopulate = [
    { path: "senderId", select: "firstName lastName image" }
];


export const createIdentityRequest = async ({ data, options } = {}) => {
    return await baseRepo.createOne({ model: IdentityRequestModel, data, options });
};

export const findIdentityRequestById = async ({ id, options = {} } = {}) => {
    return await baseRepo.findById({
        model: IdentityRequestModel,
        id,
        options: { populate: defaultRequestPopulate, ...options }
    });
};

export const findOneIdentityRequest = async ({ filter = {}, options = {} } = {}) => {
    return await baseRepo.findOne({
        model: IdentityRequestModel,
        filter,
        options: { populate: defaultRequestPopulate, lean: true, ...options }
    });
};

export const paginateIdentityRequests = async ({ filter = {}, page, limit, options = {} } = {}) => {
    return await baseRepo.paginate({
        model: IdentityRequestModel,
        filter,
        page,
        limit,
        options: {
            sort: { createdAt: -1 },
            populate: defaultRequestPopulate,
            lean: true,
            ...options
        }
    });
};

export const updateIdentityRequest = async ({ filter = {}, update = {}, options = {} } = {}) => {
    return await baseRepo.updateOne({ model: IdentityRequestModel, filter, update, options });
};


export const createConversation = async ({ data, options } = {}) => {
    return await baseRepo.createOne({ model: ConversationModel, data, options });
};

export const findConversationById = async ({ id, options = {} } = {}) => {
    return await baseRepo.findById({
        model: ConversationModel,
        id,
        options: { populate: defaultConversationPopulate, ...options }
    });
};

export const findOneConversation = async ({ filter = {}, options = {} } = {}) => {
    return await baseRepo.findOne({
        model: ConversationModel,
        filter,
        options: { populate: defaultConversationPopulate, lean: true, ...options }
    });
};

export const paginateConversations = async ({ filter = {}, page, limit, options = {} } = {}) => {
    return await baseRepo.paginate({
        model: ConversationModel,
        filter,
        page,
        limit,
        options: {
            sort: { updatedAt: -1 },
            populate: defaultConversationPopulate,
            lean: true,
            ...options
        }
    });
};

export const updateConversation = async ({ filter = {}, update = {}, options = {} } = {}) => {
    return await baseRepo.updateOne({ model: ConversationModel, filter, update, options });
};


export const createConversationMessage = async ({ data, options } = {}) => {
    return await baseRepo.createOne({ model: ConversationMessageModel, data, options });
};

export const paginateConversationMessages = async ({ filter = {}, page, limit, options = {} } = {}) => {
    return await baseRepo.paginate({
        model: ConversationMessageModel,
        filter,
        page,
        limit,
        options: {
            sort: { createdAt: -1 },
            populate: defaultMessagePopulate,
            lean: true,
            ...options
        }
    });
};
