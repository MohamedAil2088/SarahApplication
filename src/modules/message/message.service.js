import { NotFoundException, BadRequestException } from "../../common/exceptions/error.exceptions.js";
import { findUserById } from "../../common/repository/base.respository/user.repository.js";
import { MessageTypeEnum } from "../../enum/index.js";
import * as messageRepo from "../../common/repository/base.respository/message.repository.js";

const anonymousMessage = (message) => {
    const result = message.toObject ? message.toObject() : { ...message };
    delete result.senderId;
    return result;
};

export const creatMessage = async ({ content, receiverId } = {}, files = [], user = undefined) => {
    if (user && user._id.toString() === receiverId.toString()) {
        throw BadRequestException("You cannot send an anonymous message to yourself");
    }
    const cheakReceiverExist = await findUserById({ id: receiverId });
    if (!cheakReceiverExist) throw NotFoundException("Invalid receiver Id");
    const message = await messageRepo.createMessage({
        data: {
            receiverId,
            content,
            attachments: files.map(ele => ele.path),
            ...(user ? { senderId: user._id } : {})
        }
    });
    return anonymousMessage(message);
};

export const deleteMessage = async ({ messageId } = {}, user) => {
    const message = await messageRepo.deleteOneMessage({
        filter: { _id: messageId, receiverId: user._id }
    });
    if (!message.deletedCount) throw NotFoundException("Message not found or you are not authorized to delete it");
    return message;
};

export const getAllMessage = async ({ type, page, limit } = {}, user) => {
    const filterStrategies = {
        [MessageTypeEnum.INBOX]: { receiverId: user._id },
        [MessageTypeEnum.OUTBOX]: { senderId: user._id },
        [MessageTypeEnum.ALL]: {
            $or: [
                { senderId: user._id },
                { receiverId: user._id }
            ]
        }
    };
    const filter = filterStrategies[type] || filterStrategies[MessageTypeEnum.ALL];
    const result = await messageRepo.paginateMessages({ filter, page, limit });
    return { ...result, docs: result.docs.map(anonymousMessage) };
};

export const getMessage = async ({ messageId } = {}, user) => {
    const message = await messageRepo.findOneMessage({
        filter: {
            _id: messageId,
            $or: [{ receiverId: user._id }, { senderId: user._id }]
        }
    });
    if (!message) throw NotFoundException("Message not found or you are not authorized to view it");
    return anonymousMessage(message);
};
