import { EventEmitter } from "node:events";
import { sendEmail } from "./send.email.js";
import { verifyEmailTemplate } from "./email.templet.js";
import { EmailSubjectMap, LanguageEnum } from "../../../enum/index.js";

export const emailEvent = new EventEmitter();

export const sendOtpEmail = async ({ recipient, subject, data, lang = LanguageEnum.EN }) => {
        const isAr = lang === LanguageEnum.AR || lang === "ar" || lang === 0 || lang === "0";
        const targetLang = isAr ? LanguageEnum.AR : LanguageEnum.EN;
        const emailSubject = EmailSubjectMap?.[targetLang]?.[subject] || subject;
        await sendEmail({
            ...recipient,
            subject: emailSubject,
            html: verifyEmailTemplate({
                code: data.code,
                subject,
                title: emailSubject,
                lang: targetLang
            })
        });
};

emailEvent.on("sendEmail", (payload) => {
    sendOtpEmail(payload).catch((error) => console.error("Email Event Error:", error));
});
