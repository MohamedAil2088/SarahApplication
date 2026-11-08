import mongoose from "mongoose";
import { GenderEnum, RoleEnum, LanguageEnum } from "../../enum/index.js";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      minLength: 2,
      maxLength: 25,
      required: true,
      alias: 'fristName',
    },
    lastName: {
      type: String,
      minLength: 2,
      maxLength: 25,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: String,
    DOB: Date,
    confirmEmail: Date,
    image: String,
    coverImage: [String],
    gender: {
      type: Number,
      enum: Object.values(GenderEnum),
      default: GenderEnum.MALE,
    },
    role: {
      type: Number,
      enum: Object.values(RoleEnum),
      default: RoleEnum.USER,
    },
    changeCredentialTime: Date,
    language: {
      type: Number,
      enum: Object.values(LanguageEnum),
      default: LanguageEnum.AR,
    },
    twoStepVerification: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toObject: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        return ret;
      }
    },
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.password;
        return ret;
      }
    },
    strict: true,
    strictQuery: true,
    autoIndex: true,
  },
);

userSchema.virtual("username").set(function (value) {
  const [firstName, lastName] = value?.split(" ") || [];
  this.set({ firstName, lastName });
}).get(function () {
  return `${this.firstName || this.fristName || ''} ${this.lastName || ''}`.trim();
});

export const UserModel =
  mongoose.models.user || mongoose.model("user", userSchema);
