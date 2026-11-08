import { findByIdAndUpdate } from "../../common/repository/base.respository/base.repository.js";
import { UserModel } from "../../DB/model/user.model.js";
import { encryption } from "../../common/security/encryption.security.js";
import { createLoginCredentials, creatRevokeToken, userBaseRevokrTokevKey, userProfileKey } from "../../common/security/token.security.js";
import { ACCESS_TOKEN_EXPIERS_IN } from "../../config.js";
import { ConflictExecuption } from "../../common/exceptions/error.exceptions.js";
import { del, keys, set, get } from "../../common/services/index.js";
import { LogoutEnum } from "../../enum/security.enum.js";
export const profile = async (account) => {
  const key = userProfileKey({ userId: account._id });

  const cachedProfile = await get({ key });
  if (cachedProfile) {
    return cachedProfile;
  }

  const profileData = account.toObject ? account.toObject() : { ...account };
  delete profileData.password;
  await set({ key, value: profileData, ttl: 86400 });

  return profileData;
};

export const update = async (user, data) => {
  const updateData = { ...data };

  if (updateData.username) {
    const [firstName, ...rest] = updateData.username.trim().split(" ");
    updateData.firstName = firstName;
    updateData.lastName = rest.join(" ") || firstName;
    delete updateData.username;
  }

  if (updateData.phone) {
    updateData.phone = await encryption(updateData.phone);
  }

  const account = await findByIdAndUpdate({
    model: UserModel,
    id: user._id,
    update: updateData,
  });

  const key = userProfileKey({ userId: user._id });
  const profileData = account.toObject ? account.toObject() : { ...account };
  delete profileData.password;
  await set({ key, value: profileData, ttl: 86400 });

  return profileData;
};

export const rotateToken = async (payload,user, issuer) => {
  const accessExpiresIn = (payload.iat + ACCESS_TOKEN_EXPIERS_IN) * 1000;
  const currentTime = Date.now() + (30 * 60000);
  if (currentTime < accessExpiresIn) {
    throw ConflictExecuption("Sorry we cannot new login credentials while current access token still within valid time range",
    );
  }
  const data = await createLoginCredentials({user , issuer})
  await creatRevokeToken(payload)
  return data
};

export const logout = async (payload, user, { action = LogoutEnum.DEVICE } = {}) => {
  switch (action) {
    case LogoutEnum.ALL:
      user.changeCredentialTime = new Date();
      await user.save();

      const tokenKeys = await keys({ prefix: userBaseRevokrTokevKey({ userId: payload.sub }) });
      if (tokenKeys.length > 0) {
        await del({ key: tokenKeys });
      }
      break;

    default:
      await creatRevokeToken(payload);
      break;
  }

  return;
};
