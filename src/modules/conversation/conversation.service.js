import {
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException
} from "../../common/exceptions/error.exceptions.js";
import * as messageRepo from "../../common/repository/base.respository/message.repository.js";
import * as conversationRepo from "../../common/repository/base.respository/conversation.repository.js";
import { RequestStatusEnum } from "../../enum/index.js";

export const requestSenderIdentity = async ({ messageId } = {}, user) => {
    const message = await messageRepo.findMessageById({ id: messageId });
    if (!message) throw NotFoundException("Message not found");

    const receiverId = message.receiverId?._id || message.receiverId;
    if (receiverId.toString() !== user._id.toString()) {
        throw ForbiddenException("You are not authorized to request identity for this message");
    }

    const targetSenderId = message.senderId?._id || message.senderId;
    if (!targetSenderId) {
        throw BadRequestException("Cannot request identity for an anonymous guest message without a registered sender");
    }

    const existingRequest = await conversationRepo.findOneIdentityRequest({
        filter: { messageId }
    });
    if (existingRequest) {
        throw ConflictException("An identity request for this message already exists");
    }

    return await conversationRepo.createIdentityRequest({
        data: {
            messageId,
            requesterId: user._id,
            targetSenderId,
            status: RequestStatusEnum.PENDING
        }
    });
};

export const getReceivedIdentityRequests = async ({ page, limit } = {}, user) => {
    return await conversationRepo.paginateIdentityRequests({
        filter: { targetSenderId: user._id },
        page,
        limit
    });
};

export const respondToIdentityRequest = async ({ requestId, action } = {}, user) => {
    const request = await conversationRepo.findIdentityRequestById({ id: requestId });
    if (!request) throw NotFoundException("Identity request not found");

    const targetSenderId = request.targetSenderId?._id || request.targetSenderId;
    if (targetSenderId.toString() !== user._id.toString()) {
        throw ForbiddenException("You are not authorized to respond to this request");
    }

    if (request.status !== RequestStatusEnum.PENDING) {
        throw ConflictException("This request has already been processed");
    }

    const requesterId = request.requesterId?._id || request.requesterId;
    const messageId = request.messageId?._id || request.messageId;

    if (action === RequestStatusEnum.REJECTED) {
        await conversationRepo.updateIdentityRequest({
            filter: { _id: requestId },
            update: { status: RequestStatusEnum.REJECTED }
        });
        return { message: "Identity request rejected successfully" };
    }

    await conversationRepo.updateIdentityRequest({
        filter: { _id: requestId },
        update: { status: RequestStatusEnum.ACCEPTED }
    });

    let conversation = await conversationRepo.findOneConversation({
        filter: { originalMessageId: messageId }
    });

    if (!conversation) {
        conversation = await conversationRepo.createConversation({
            data: {
                originalMessageId: messageId,
                participants: [targetSenderId, requesterId]
            }
        });
    }

    return {
        message: "Identity request accepted and conversation created",
        conversation
    };
};

export const getConversations = async ({ page, limit } = {}, user) => {
    return await conversationRepo.paginateConversations({
        filter: { participants: user._id },
        page,
        limit
    });
};

export const sendConversationMessage = async ({ conversationId, content } = {}, files = [], user) => {
    const conversation = await conversationRepo.findConversationById({ id: conversationId });
    if (!conversation) throw NotFoundException("Conversation not found");

    const isParticipant = conversation.participants.some(
        (p) => (p._id || p).toString() === user._id.toString()
    );
    if (!isParticipant) {
        throw ForbiddenException("You are not a participant in this conversation");
    }

    const message = await conversationRepo.createConversationMessage({
        data: {
            conversationId,
            senderId: user._id,
            content,
            attachments: files.map((f) => f.path)
        }
    });

    await conversationRepo.updateConversation({
        filter: { _id: conversationId },
        update: { lastMessage: message._id }
    });

    return message;
};

export const getConversationMessages = async ({ conversationId, page, limit } = {}, user) => {
    const conversation = await conversationRepo.findConversationById({ id: conversationId });
    if (!conversation) throw NotFoundException("Conversation not found");

    const isParticipant = conversation.participants.some(
        (p) => (p._id || p).toString() === user._id.toString()
    );
    if (!isParticipant) {
        throw ForbiddenException("You are not a participant in this conversation");
    }

    return await conversationRepo.paginateConversationMessages({
        filter: { conversationId },
        page,
        limit
    });
};