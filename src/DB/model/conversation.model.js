import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    originalMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message",
        required: true,
        unique: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "conversationMessage"
    }
},
    {
        timestamps: true
    });

    conversationSchema.index({participants:1});

export const ConversationModel = mongoose.models.conversation || mongoose.model("conversation", conversationSchema);