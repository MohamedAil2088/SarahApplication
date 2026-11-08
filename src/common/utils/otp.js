import { randomInt } from "node:crypto";

export const creatOtp = () => {
    return randomInt(100000, 1000000);
};