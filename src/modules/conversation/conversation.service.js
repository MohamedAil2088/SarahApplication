import {
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException
} from "../../common/exceptions/error.exceptions.js";
import * as messageRepo from "../../common/repository/base.respository/message.repository.js";
import * as conversationRepo from "../../common/repository/base.respository/conversation.repository.js";
import { RequestStatusEnum } from "../../enum/index.js";
import mongoose from "mongoose";

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

    const request = await conversationRepo.createIdentityRequest({
        data: {
            messageId,
            requesterId: user._id,
            targetSenderId,
            status: RequestStatusEnum.PENDING
        }
    });
    const result = request.toObject ? request.toObject() : { ...request };
    delete result.targetSenderId;
    return result;
};

export const getReceivedIdentityRequests = async ({ page, limit } = {}, user) => {
    return await conversationRepo.paginateIdentityRequests({
        filter: { targetSenderId: user._id },
        page,
        limit
    });
};

export const respondToIdentityRequest = async ({ requestId, action } = {}, user) => {
    if (![RequestStatusEnum.ACCEPTED, RequestStatusEnum.REJECTED].includes(action)) {
        throw BadRequestException("Invalid identity request action");
    }
    return await mongoose.connection.transaction(async (session) => {
        const request = await conversationRepo.findIdentityRequestById({ id: requestId, options: { session } });
        if (!request) throw NotFoundException("Identity request not found");

        const targetSenderId = request.targetSenderId?._id || request.targetSenderId;
        if (targetSenderId.toString() !== user._id.toString()) {
            throw ForbiddenException("You are not authorized to respond to this request");
        }

        if (request.status !== RequestStatusEnum.PENDING &&
            !(request.status === RequestStatusEnum.ACCEPTED && action === RequestStatusEnum.ACCEPTED)) {
            throw ConflictException("This request has already been processed");
        }

        const requesterId = request.requesterId?._id || request.requesterId;
        const messageId = request.messageId?._id || request.messageId;

        if (action === RequestStatusEnum.REJECTED) {
            await conversationRepo.updateIdentityRequest({
                filter: { _id: requestId },
                update: { status: RequestStatusEnum.REJECTED },
                options: { session }
            });
            return { message: "Identity request rejected successfully" };
        }

        let conversation = await conversationRepo.findOneConversation({
            filter: { originalMessageId: messageId },
            options: { session }
        });

        if (!conversation) {
            conversation = await conversationRepo.createConversation({
                data: {
                    originalMessageId: messageId,
                    participants: [targetSenderId, requesterId]
                },
                options: { session }
            });
        }

        await conversationRepo.updateIdentityRequest({
            filter: { _id: requestId },
            update: { status: RequestStatusEnum.ACCEPTED },
            options: { session }
        });

        return {
            message: "Identity request accepted and conversation created",
            conversation
        };
    });
};

export const getConversations = async ({ page, limit } = {}, user) => {
    return await conversationRepo.paginateConversations({
        filter: { participants: user._id },
        page,
        limit
    });
};

export const sendConversationMessage = async ({ conversationId, content } = {}, files = [], user) => {
    return await mongoose.connection.transaction(async (session) => {
        const conversation = await conversationRepo.findConversationById({ id: conversationId, options: { session } });
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
            },
            options: { session }
        });

        await conversationRepo.updateConversation({
            filter: { _id: conversationId },
            update: { lastMessage: message._id },
            options: { session }
        });

        return message;
    });
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
