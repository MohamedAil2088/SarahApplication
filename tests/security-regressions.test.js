import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";

async function load(file, mocks = {}) {
  const cache = new Map();
  async function moduleAt(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const override = Object.entries(mocks).find(([suffix]) => filename.replaceAll("\\", "/").endsWith(suffix))?.[1];
    const mod = override
      ? new vm.SyntheticModule(Object.keys(override), function () {
          for (const [key, value] of Object.entries(override)) this.setExport(key, value);
        })
      : new vm.SourceTextModule(await readFile(filename, "utf8"), { identifier: filename });
    cache.set(filename, mod);
    if (!override) await mod.link((specifier) => moduleAt(path.resolve(path.dirname(filename), specifier)));
    return mod;
  }
  const mod = await moduleAt(path.resolve(file));
  await mod.evaluate();
  return mod.namespace;
}

test("anonymous message responses hide the registered sender", async () => {
  const api = await load("src/modules/message/message.service.js", {
    "user.repository.js": { findUserById: async () => ({ _id: "receiver" }) },
    "message.repository.js": {
      findOneMessage: async () => ({ content: "hello", senderId: { email: "private@example.com" } }),
      paginateMessages: async () => ({ docs: [{ senderId: "private-id" }], totalCount: 1 }),
      createMessage: async ({ data }) => data,
      deleteOneMessage: async () => ({ deletedCount: 1 })
    }
  });
  assert.equal((await api.getMessage({ messageId: "id" }, { _id: "receiver" })).senderId, undefined);
  assert.equal((await api.getAllMessage({}, { _id: "receiver" })).docs[0].senderId, undefined);
  assert.equal((await api.creatMessage({ receiverId: "receiver", content: "hello" }, [], { _id: "sender" })).senderId, undefined);
});

test("success responses preserve supplied messages and false data", async () => {
  const { successResponse } = await load("src/common/utils/success.respons.js");
  const res = { status() { return this; }, json(body) { return body; } };
  const body = successResponse({ res, message: "Saved", data: false });
  assert.equal(body.message, "Saved");
  assert.equal(body.data, false);
});

test("Basic authentication cannot bypass the login challenge", async () => {
  const { authentication } = await load("src/middleware/authentication.middleware.js", {
    "token.security.js": { basicAuth: async () => ({ _id: "user" }), decodeToken: async () => ({}) }
  });
  let failure;
  try {
    await authentication()({ headers: { authorization: "Basic dTpw" } }, {}, (error) => { failure = error; });
  } catch (error) { failure = error; }
  assert.equal(failure?.cause?.status, 401);
});

export { load };
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { localFileUpload } from "../src/common/utils/multer/local.multer.js";
import { Readable } from "node:stream";

test("session revocation lasts through refresh expiry, including older access tokens", async () => {
  let stored;
  const api = await load("src/common/security/token.security.js", {
    "/jsonwebtoken": { default: jwt },
    "/node:crypto": { randomUUID },
    "config.js": { ACCESS_TOKEN_EXPIERS_IN: 1600, REFRESH_TOKEN_EXPIERS_IN: 31536000,
      ACCESS_USER_TOKEN_SIGNATURE: "access", ACCESS_ADMIN_TOKEN_SIGNATURE: "admin",
      REFRESH_USER_TOKEN_SIGNATURE: "refresh", REFRESH_ADMIN_TOKEN_SIGNATURE: "admin-refresh" },
    "base.repository.js": { findById: async () => ({}), findOne: async () => ({}) },
    "user.model.js": { UserModel: {} },
    "/services/index.js": { exists: async () => false, set: async () => {},
      setIfAbsent: async (value) => { stored = value; return "OK"; } },
    "hash.security.js": { compare: async () => true }
  });
  const iat = Math.floor(Date.now() / 1000) - 100;
  await api.creatRevokeToken({ sub: "u", jti: "session", iat, exp: iat + 1600 });
  assert.ok(stored.ttl > 31535000);
});

test("concurrent refresh attempts cannot create two sessions", async () => {
  let consumed = false;
  let issued = 0;
  const api = await load("src/modules/user/user.service.js", {
    "base.repository.js": { findByIdAndUpdate: async () => ({}) },
    "user.model.js": { UserModel: {} },
    "encryption.security.js": { encryption: async (x) => x },
    "token.security.js": {
      createLoginCredentials: async () => { issued++; return {}; },
      creatRevokeToken: async () => { if (consumed) return null; consumed = true; return "OK"; },
      userBaseRevokrTokevKey: () => "revoke", userProfileKey: () => "profile"
    },
    "config.js": { ACCESS_TOKEN_EXPIERS_IN: 1600 },
    "/services/index.js": { del: async () => {}, keys: async () => [], set: async () => {}, get: async () => null }
  });
  const payload = { iat: Math.floor(Date.now() / 1000) - 2000 };
  const results = await Promise.allSettled([api.rotateToken(payload, {}, "issuer"), api.rotateToken(payload, {}, "issuer")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(issued, 1);
});

async function authService({ compare = async () => false, send = async () => {}, create = async ({ data }) => data } = {}) {
  let attempts = 0;
  const account = { _id: "u", save: async () => {} };
  const utils = { creatOtp: () => 123456, emailEvent: { emit() {} },
    UserEmailKey: ({ email, subject }) => email + subject, UserEmailtrialsKey: () => "trials" };
  return load("src/modules/authentication/authentication.service.js", {
    "/base.respository/index.js": { findOne: async ({ filter }) => filter.confirmEmail ? account : null,
      createOne: create, updateOne: async () => {} },
    "user.model.js": { UserModel: { deleteOne: async () => {} } },
    "/security/index.js": { compare, hash: async (x) => x, encryption: async (x) => x,
      createLoginCredentials: async () => ({}), userProfileKey: () => "profile",
      userLoginAttemptsKey: () => "attempts", userBaseRevokrTokevKey: () => "revoked" },
    "cache.service.js": { set: async () => {}, get: async () => null, del: async () => {},
      ttl: async () => -2, incrBy: async () => 1, incr: async () => 1, expire: async () => {},
      keys: async () => [], reserveOtpAttempt: async () => ++attempts <= 5 ? "hash" : null,
      consumeOtp: async () => 1 },
    "/utils/index.js": utils, "email.event.js": { sendOtpEmail: send }
  });
}

test("OTP verification stops hash comparisons after five attempts", async () => {
  let comparisons = 0;
  const api = await authService({ compare: async () => { comparisons++; return false; } });
  for (let i = 0; i < 6; i++) {
    await assert.rejects(api.verfiyLoginOtp({ email: "a@example.com", otp: "000000" }, "issuer"));
  }
  assert.equal(comparisons, 5);
});

test("signup saves DOB and gender and propagates delivery failure", async () => {
  let saved;
  const api = await authService({ create: async ({ data }) => { saved = data; return { _id: "u", ...data }; } });
  const DOB = new Date("2000-01-01");
  await api.signup({ email: "a@example.com", password: "pw", username: "A B", phone: "123", DOB, gender: 1 });
  assert.equal(saved.DOB, DOB);
  assert.equal(saved.gender, 1);
  const failingApi = await authService({ send: async () => { throw new Error("delivery failed"); } });
  await assert.rejects(failingApi.signup({ email: "b@example.com", password: "pw", username: "C D", phone: "123" }), /delivery failed/);
});

test("identity acceptance shares one transaction and does not mark accepted on create failure", async () => {
  const session = {};
  let accepted = false;
  const api = await load("src/modules/conversation/conversation.service.js", {
    "/mongoose": { default: { connection: { transaction: async (fn) => fn(session) } } },
    "message.repository.js": {},
    "conversation.repository.js": {
      findIdentityRequestById: async ({ options }) => {
        assert.equal(options.session, session);
        return { targetSenderId: "sender", requesterId: "receiver", messageId: "m", status: 0 };
      },
      findOneConversation: async ({ options }) => { assert.equal(options.session, session); return null; },
      createConversation: async ({ options }) => { assert.equal(options.session, session); throw new Error("write failed"); },
      updateIdentityRequest: async () => { accepted = true; }
    }
  });
  await assert.rejects(api.respondToIdentityRequest({ requestId: "r", action: 1 }, { _id: "sender" }), /write failed/);
  assert.equal(accepted, false);
  await assert.rejects(api.respondToIdentityRequest({ requestId: "r", action: "2" }, { _id: "sender" }), /Invalid identity/);
});

test("multipart parser rejects a fourth file before downstream validation", async () => {
  const boundary = "test-boundary";
  const multipart = Array.from({ length: 4 }, (_, i) =>
    `--${boundary}\r\nContent-Disposition: form-data; name="attachments"; filename="${i}.png"\r\nContent-Type: image/png\r\n\r\nx\r\n`
  ).join("") + `--${boundary}--\r\n`;
  const req = Readable.from([Buffer.from(multipart)]);
  req.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(Buffer.byteLength(multipart)) };
  const error = await new Promise((resolve) => localFileUpload().array("attachments", 3)(req, {}, resolve));
  assert.ok(error);
  assert.ok(["LIMIT_FILE_COUNT", "LIMIT_UNEXPECTED_FILE"].includes(error.code));
});
test("requesting identity does not reveal the sender ID before consent", async () => {
  const api = await load("src/modules/conversation/conversation.service.js", {
    "/mongoose": { default: {} },
    "message.repository.js": { findMessageById: async () => ({ receiverId: "receiver", senderId: "private-id" }) },
    "conversation.repository.js": { findOneIdentityRequest: async () => null,
      createIdentityRequest: async ({ data }) => ({ _id: "request", ...data }) }
  });
  const result = await api.requestSenderIdentity({ messageId: "m" }, { _id: "receiver" });
  assert.equal(result.targetSenderId, undefined);
  assert.equal(result._id, "request");
});

test("identity rejection uses the parsed numeric action from validation", async () => {
  const routes = [];
  const router = Object.fromEntries(["post", "get", "patch"].map((method) =>
    [method, (route, ...handlers) => routes.push({ method, route, handlers })]));
  let action;
  await load("src/modules/conversation/conversation.controller.js", {
    "/express": { Router: () => router },
    "authentication.middleware.js": { authentication: () => () => {} },
    "validation.middleware.js": { Validation: () => () => {} },
    "multer.middleware.js": { uploadMiddleware: () => () => {} },
    "/utils/index.js": { fileValidation: { Image: [] }, localFileUpload: () => ({ array: () => {} }) },
    "conversation.validation.js": { requestIdentity() {}, paginationQuery() {}, respondToRequest() {},
      sendConversationMessage() {}, getConversationMessages() {} },
    "conversation.service.js": { respondToIdentityRequest: async (data) => { action = data.action; } }
  });
  const route = routes.find((item) => item.method === "patch");
  const res = { status() { return this; }, json() {} };
  await route.handlers.at(-1)({ params: { requestId: "r" }, body: { action: "2" },
    validate: { body: { action: 2 } }, user: {} }, res);
  assert.equal(action, 2);
});

test("profile image updates invalidate the cached profile after saving", async () => {
  const routes = [];
  const router = Object.fromEntries(["use", "post", "get", "patch"].map((method) =>
    [method, (route, ...handlers) => routes.push({ method, route, handlers })]));
  const calls = [];
  await load("src/modules/user/user.controller.js", {
    "/express": { Router: () => router },
    "/utils/index.js": { successResponse: (value) => value },
    "user.service.js": { logout() {}, profile() {}, rotateToken() {}, update() {} },
    "authentication.middleware.js": { authentication: () => () => {}, authorization: () => () => {} },
    "local.multer.js": { fileValidation: { Image: [] }, localFileUpload: () => ({ single: () => {} }) },
    "multer.middleware.js": { uploadMiddleware: () => () => {} },
    "validation.middleware.js": { Validation: () => () => {} },
    "user.validation.js": { updateUser() {} },
    "message.controller.js": { default: {} },
    "cache.service.js": { del: async ({ key }) => calls.push(key) },
    "token.security.js": { userProfileKey: ({ userId }) => userId + ":profile" }
  });
  const route = routes.find((item) => item.route === "/profile-image");
  await route.handlers.at(-1)({ file: { path: "assets/users/image.png" },
    user: { _id: "u", save: async () => calls.push("save") } }, {});
  assert.deepEqual(calls, ["save", "u:profile"]);
});
test("chat creation and lastMessage update use the same transaction", async () => {
  const session = {};
  const operations = [];
  const api = await load("src/modules/conversation/conversation.service.js", {
    "/mongoose": { default: { connection: { transaction: async (fn) => fn(session) } } },
    "message.repository.js": {},
    "conversation.repository.js": {
      findConversationById: async ({ options }) => {
        assert.equal(options.session, session);
        return { participants: ["sender", "receiver"] };
      },
      createConversationMessage: async ({ options }) => {
        assert.equal(options.session, session); operations.push("message");
        return { _id: "new-message" };
      },
      updateConversation: async ({ options, update }) => {
        assert.equal(options.session, session);
        assert.equal(update.lastMessage, "new-message");
        operations.push("lastMessage");
      }
    }
  });
  await api.sendConversationMessage({ conversationId: "c", content: "hello" }, [], { _id: "sender" });
  assert.deepEqual(operations, ["message", "lastMessage"]);
});
