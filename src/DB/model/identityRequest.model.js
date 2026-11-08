import mongoose from "mongoose";
import { RequestStatusEnum } from "../../enum/index.js";

const identityRequestSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message",
        required: true,
        unique: true
    },
    requesterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    targetSenderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    status: {
        type: Number,
        enum: Object.values(RequestStatusEnum),
        default: RequestStatusEnum.PENDING
    }
},
    {
        timestamps: true
    }
);

export const IdentityRequestModel = mongoose.models.identityRequest || mongoose.model("identityRequest", identityRequestSchema);