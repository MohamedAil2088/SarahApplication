import mongoose from "mongoose";


const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      minLength: 2,
      maxLength: 50000,
      required: function () {
        return this.attachments?.length > 0 ? false : true
      },
    },
    attachments: [String],
    senderId: { type: mongoose.Types.ObjectId, ref: "user" },
    receiverId: { type: mongoose.Types.ObjectId, ref: "user", required: true },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    strict: true,
    strictQuery: true,
    autoIndex: true,
  },
);

messageSchema.index({ receiverId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

export const MessageModel = mongoose.models.message || mongoose.model("message", messageSchema);
