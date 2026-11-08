import { ConflictException, ConflictExecuption, NotFoundExecuption, TooManyRequestsException } from "../../common/exceptions/error.exceptions.js";
import { findOne, createOne, updateOne } from "../../common/repository/base.respository/index.js";
import { UserModel } from "./../../DB/model/user.model.js";
import { compare, hash, encryption, createLoginCredentials, userProfileKey, userLoginAttemptsKey, userBaseRevokrTokevKey } from "../../common/security/index.js";
import { set, get, del, ttl, incrBy, expire, keys, incr } from "../../common/services/cache.service.js";
import { creatOtp, emailEvent, UserEmailKey, UserEmailtrialsKey } from "../../common/utils/index.js";
import { EmailSubjectEnum } from "../../enum/email.enum.js";
import { RoleEnum, LanguageEnum } from "../../enum/index.js";

const MAX_LOGIN_ATEMPTS = 5;
const LOCKOUT_DURATION = 900;

const sendEmailOtp = async ({ email, subject = EmailSubjectEnum.CONFIRM_EMAIL, lang = "en", expiresIn = 120, maxTrials = 3, blockInSeconds = 300, title }) => {

  const existOTP_TTL = await ttl({ key: UserEmailKey({ email, subject }) });
  if (existOTP_TTL > 0) {
    throw ConflictException(`Soory we can not creat otp while existing one stille vaild please try agin later ${existOTP_TTL} seconds`);
  }
  const oldTrials = (await get({ key: UserEmailtrialsKey({ email, subject }) })) ?? 0;
  if (oldTrials >= maxTrials) {
    const trialsTTL = await ttl({ key: UserEmailtrialsKey({ email, subject }) });
    throw TooManyRequestsException(
      trialsTTL > 0
        ? `Max otp triales has been reached please try agin later ${trialsTTL} seconds`
        : "Max otp triales has been reached"
    );
  }
  const code = creatOtp();
  await set({
    key: UserEmailKey({ email, subject }),
    value: await hash(code.toString()),
    ttl: expiresIn
  });
  const currentTrials = await incrBy({ key: UserEmailtrialsKey({ email, subject }) });
  if (currentTrials === 1 || currentTrials >= maxTrials) {
    await expire({ key: UserEmailtrialsKey({ email, subject }), ttl: blockInSeconds });
  }
  emailEvent.emit("sendEmail", {
    recipient: { to: email },
    subject,
    data: { code, title: title ?? subject },
    lang
  });
};
export const signup = async ({ email, password, username, DOB, gender, phone }, lang = "en") => {
  const duplicatedAccount = await findOne({
    model: UserModel,
    filter: { email },
    select: "email"
  });
  if (duplicatedAccount) {
    throw ConflictExecuption("Email Exist");
  }
  const isEnSignup = lang === LanguageEnum.EN || lang === "en" || lang === 1 || lang === "1";
  const userLang = isEnSignup ? LanguageEnum.EN : LanguageEnum.AR;
  const account = await createOne({
    model: UserModel,
    data: {
      email,
      password: await hash(password),
      username,
      phone: await encryption(phone),
      role: RoleEnum.USER,
      language: userLang
    }
  });
  try {
    await sendEmailOtp({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL, lang })
  } catch (error) {
    console.error("Signup Email Error:", error);
    await UserModel.deleteOne({ _id: account._id });
    throw error
  }

  const sanitizedAccount = account.toObject ? account.toObject() : { ...account };
  delete sanitizedAccount.password;
  return sanitizedAccount;
}
export const confirmEmail = async ({ email, code, otp }) => {
  const account = await findOne({
    model: UserModel,
    filter: { email, confirmEmail: { $exists: false } },
  });
  if (!account) throw NotFoundExecuption("not exist");

  const inputOtp = String(code || otp);
  const hashOtp = await get({
    key: UserEmailKey({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL })
  });

  if (!hashOtp || !await compare(inputOtp, hashOtp)) {
    throw ConflictException("Invalid OTP");
  }

  account.confirmEmail = new Date();
  await account.save();

  const userOtpKeys = await keys({ prefix: UserEmailKey({ email, subject: EmailSubjectEnum.CONFIRM_EMAIL }) });
  if (userOtpKeys?.length) {
    await del({ key: userOtpKeys });
  }

  return;
};

export const resendConfirmEmail = async ({ email }, lang = "en") => {
  const account = await findOne({
    model: UserModel,
    filter: { email, confirmEmail: { $exists: false } },
  });
  if (!account) throw NotFoundExecuption("Invailed account");

  const isReqEn = lang === LanguageEnum.EN || lang === "en" || lang === 1 || lang === "1";
  const isAccountEn = account.language === LanguageEnum.EN || account.language === 1 || account.language === "en";
  const isEn = isReqEn || isAccountEn;

  await sendEmailOtp({
    email,
    subject: EmailSubjectEnum.CONFIRM_EMAIL,
    lang: isEn ? LanguageEnum.EN : LanguageEnum.AR
  });

  return;
};

export const requestForgotPassword = async ({ email }, lang = "en") => {
  const account = await findOne({
    model: UserModel,
    filter: {
      email,
      confirmEmail: { $exists: true }
    },
  });
  if (!account) throw NotFoundExecuption("Invailed account");

  const isReqEn = lang === LanguageEnum.EN || lang === "en" || lang === 1 || lang === "1";
  const isAccountEn = account.language === LanguageEnum.EN || account.language === 1 || account.language === "en";
  const isEn = isReqEn || isAccountEn;

  await sendEmailOtp({
    email,
    subject: EmailSubjectEnum.FORGET_PASSWORD,
    lang: isEn ? LanguageEnum.EN : LanguageEnum.AR
  });

  return;
};

export const verfiyForgotPasswordCode = async ({ email, code, otp }) => {
  const account = await findOne({
    model: UserModel,
    filter: { email, confirmEmail: { $exists: true } },
  });
  if (!account) throw NotFoundExecuption("not exist");

  const inputOtp = String(code || otp);
  const hashOtp = await get({
    key: UserEmailKey({ email, subject: EmailSubjectEnum.FORGET_PASSWORD })
  });

  if (!hashOtp || !await compare(inputOtp, hashOtp)) {
    throw ConflictException("Invalid OTP");
  }
  return account;
};

export const resetForgetPassword = async ({ email, otp, password }) => {
  const account = await verfiyForgotPasswordCode({ otp, email })
  account.password = await hash(password)
  account.changeCredentialTime = new Date();
  await account.save();

  const result = await Promise.all([
    keys({ prefix: userBaseRevokrTokevKey({ userId: account._id }) }),
    keys({ prefix: UserEmailKey({ email, subject: EmailSubjectEnum.FORGET_PASSWORD }) })

  ])
  await del({ key: [...result[0], ...result[1]] });

  return;
}


export const login = async ({ email, password }, issuer, lang ="en") => {
  const attemptsKey = userLoginAttemptsKey({ email })
  const attempts = (await get({ key: attemptsKey })) ?? 0
  if (attempts >= MAX_LOGIN_ATEMPTS) {
    const remainingSeconds = await ttl({ key: attemptsKey })
    const remainingMinutes = Math.ceil(remainingSeconds / 60)
    throw TooManyRequestsException(`Too many login attempts. try agin after ${remainingMinutes}minutes`)
  }
  const account = await findOne({
    model: UserModel,
    filter: {
      email, confirmEmail: { $exists: true }
    },
    select: "+password"
  });
  if (!account || !(await compare(password, account.password))) {
    const currentAttempts = await incr({ key: attemptsKey })
    await expire({ key: attemptsKey, ttl: LOCKOUT_DURATION })

    if (currentAttempts >= MAX_LOGIN_ATEMPTS) {
      await expire({ key: attemptsKey, ttl: LOCKOUT_DURATION })
      throw TooManyRequestsException(`Too many login attempts. Account locked for ${LOCKOUT_DURATION} seconds`)
    }
    const remaining = MAX_LOGIN_ATEMPTS - currentAttempts;
    throw NotFoundExecuption(`Invalid credentaials. you have ${remaining} attempts remaining`)
  }
  await del({ key: attemptsKey });
  if (account.twoStepVerification) {
    const isReqEn = lang === LanguageEnum.EN || lang === "en" || lang === 1 || lang === "1";
    const isAccountEn = account.language === LanguageEnum.EN || account.language === 1 || account.language === "en";
    const isEn = isReqEn || isAccountEn;

    if (isReqEn && account.language !== LanguageEnum.EN) {
      account.language = LanguageEnum.EN;
      await updateOne({
        model: UserModel,
        filter: { _id: account._id },
        update: { language: LanguageEnum.EN }
      });
    }

    await sendEmailOtp({
      email,
      subject: EmailSubjectEnum.TWO_STEP_VERIFICATION,
      lang: isEn ? LanguageEnum.EN : LanguageEnum.AR,
      expiresIn: 120,
      title: isEn ? "Login Verification Code" : "كود التحقق لتسجيل الدخول"
    });
    return {
      twoStepVerification: true,
      message: isEn
        ? "Verification code has been sent to your email"
        : "تم إرسال كود التحقق إلى بريدك الإلكتروني"
    };
  }
  const credentials = await createLoginCredentials({ user: account, issuer })
  const profileData = account.toObject ? account.toObject() : { ...account }
  delete profileData.password;

  const result = await set({
    key: userProfileKey({ userId: account._id }),
    value: profileData,
    ttl: 86400
  });
  return credentials
};

export const verfiyLoginOtp = async ({ email, otp }, issuer) => {
  const account = await findOne({
    model: UserModel,
    filter: { email, confirmEmail: { $exists: true } }
  })
  if (!account) throw NotFoundExecuption("Acccount not found");
  const inputOtp = String(otp);
  const hashOtp = await get({
    key: UserEmailKey({ email, subject: EmailSubjectEnum.TWO_STEP_VERIFICATION })

  });
  if (!hashOtp || !(await compare(inputOtp, hashOtp))) {
    throw ConflictException("Invailed or expired OTP")
  };
  const userOtpKeys = await keys({
    prefix: UserEmailKey({ email, subject: EmailSubjectEnum.TWO_STEP_VERIFICATION })
  });
  if (userOtpKeys?.length) {
    await del({ key: userOtpKeys })
  }
  const credentials = await createLoginCredentials({ user: account, issuer });
  const profileData = account.toObject ? account.toObject() : { ...account };
  delete profileData.password;

  await set({
    key: userProfileKey({ userId: account._id }),
    value: profileData,
    ttl: 86400
  });
  return credentials;
};

