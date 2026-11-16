import assert from "node:assert/strict";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DB_URI, PORT } from "../src/config.js";
import { UserModel } from "../src/DB/model/user.model.js";
import { MessageModel, IdentityRequestModel, ConversationModel, ConversationMessageModel } from "../src/DB/model/index.js";
import { createLoginCredentials, userBaseKey } from "../src/common/security/token.security.js";
import { client } from "../src/DB/redis.connection.js";

const base = `http://127.0.0.1:${PORT}`;
const users = [];
const messages = [];
const requests = [];
const conversations = [];
const uploads = [];
const report = (name) => console.log("PASS " + name);
async function request(method, route, token, body, retried = false) {
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  if (body && !(body instanceof FormData)) headers["content-type"] = "application/json";
  const response = await fetch(base + route, {
    method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (response.status === 429 && !retried) {
    const seconds = Math.min(65, Math.max(1, Number(response.headers.get("retry-after")) || 61));
    console.log(`Waiting ${seconds}s for the normal rate-limit window`);
    await delay(seconds * 1000 + 500);
    return request(method, route, token, body, true);
  }
  return { status: response.status, data };
}
function imageForm(count = 1, fake = false) {
  const form = new FormData();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=", "base64");
  for (let i = 0; i < count; i++) {
    form.append("attachments", new Blob([fake ? Buffer.from("not an image") : png], { type: "image/png" }), "test.png");
  }
  return form;
}
try {
  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 8000 });
  for (let i = 0; i < 3; i++) {
    const user = await UserModel.create({
      firstName: "Smoke", lastName: "Test", email: `codex-test-${randomUUID()}@example.invalid`,
      password: "test-account-without-password-login", confirmEmail: new Date()
    });
    users.push(user);
  }
  const [sender, receiver, outsider] = await Promise.all(users.map((user) =>
    createLoginCredentials({ user, issuer: base })));
  report("temporary accounts created, no email sent");
  const beforeImage = await request("GET", "/user", receiver.access_token);
  assert.equal(beforeImage.status, 200);
  const profileForm = new FormData();
  profileForm.append("attachment", imageForm().get("attachments"), "profile.png");
  const profileUpload = await request("PATCH", "/user/profile-image", receiver.access_token, profileForm);
  assert.equal(profileUpload.status, 200, profileUpload.data.error_message);
  const profileImage = profileUpload.data.data.user.image;
  uploads.push(profileImage);
  const afterImage = await request("GET", "/user", receiver.access_token);
  assert.equal(afterImage.status, 200);
  assert.equal(afterImage.data.data.image, profileImage);
  report("profile image is saved and refreshed in the cached profile");

  if (!process.argv.includes("--profile-only")) {
  let result = await request("POST", "/message", sender.access_token,
    { receiverId: String(users[1]._id), content: "Temporary integration check" });
  assert.equal(result.status, 201, result.data.error_message);
  messages.push(result.data.data._id);
  assert.equal(result.data.data.senderId, undefined);
  report("anonymous response hides sender");

  const form = imageForm();
  form.append("receiverId", String(users[1]._id));
  result = await request("POST", "/message", sender.access_token, form);
  assert.equal(result.status, 201, result.data.error_message);
  messages.push(result.data.data._id);
  uploads.push(...result.data.data.attachments);
  assert.equal(result.data.data.attachments.length, 1);
  report("real image upload accepted");
  const served = await fetch(base + "/" + result.data.data.attachments[0], { signal: AbortSignal.timeout(5000) });
  assert.equal(served.status, 200);
  assert.match(served.headers.get("content-type"), /image/);
  report("uploaded image can be served");

  const fake = imageForm(1, true);
  fake.append("receiverId", String(users[1]._id));
  result = await request("POST", "/message", sender.access_token, fake);
  assert.equal(result.status, 400);
  report("disguised non-image rejected");
  const four = imageForm(4);
  four.append("receiverId", String(users[1]._id));
  result = await request("POST", "/message", sender.access_token, four);
  assert.equal(result.status, 400);
  report("fourth attachment rejected");

  result = await request("POST", `/conversation/request-identity/${messages[0]}`, receiver.access_token);
  assert.equal(result.status, 201, result.data.error_message);
  requests.push(result.data.data._id);
  assert.equal(result.data.data.targetSenderId, undefined);
  result = await request("PATCH", `/conversation/request/${requests[0]}`, sender.access_token, { action: "1" });
  assert.equal(result.status, 200, result.data.error_message);
  conversations.push(result.data.data.conversation._id);
  report("identity acceptance and MongoDB transaction succeed");
  const chat = `/conversation/${conversations[0]}/messages`;
  result = await request("GET", chat, outsider.access_token);
  assert.equal(result.status, 403);
  result = await request("POST", chat, outsider.access_token, { content: "Forbidden" });
  assert.equal(result.status, 403);
  report("third account cannot read or write conversation");
  result = await request("GET", `/message/${messages[0]}`, outsider.access_token);
  assert.equal(result.status, 404);
  report("third account cannot read original private message");
  result = await request("POST", chat, receiver.access_token, { content: "Allowed participant reply" });
  assert.equal(result.status, 201, result.data.error_message);
  const stored = await ConversationModel.findById(conversations[0]).lean();
  assert.equal(String(stored.lastMessage), result.data.data._id);
  report("chat message and lastMessage commit together");

  result = await request("POST", "/user/rotate-token", sender.refresh_token);
  assert.equal(result.status, 200, result.data.error_message);
  const rotated = result.data.data;
  result = await request("GET", "/user", rotated.access_token);
  assert.equal(result.status, 200);
  report("valid refresh issues usable new access token");
  result = await request("POST", "/user/rotate-token", sender.refresh_token);
  assert.equal(result.status, 401);
  result = await request("GET", "/user", sender.access_token);
  assert.equal(result.status, 401);
  report("rotation rejects both old tokens");
  }
  console.log("ALL LIVE CHECKS PASSED");
} catch (error) {
  console.error("LIVE CHECK FAILED:", error.message);
  process.exitCode = 1;
} finally {
  try {
    if (mongoose.connection.readyState === 1) {
      await ConversationMessageModel.deleteMany({ conversationId: { $in: conversations } });
      await ConversationModel.deleteMany({ _id: { $in: conversations } });
      await IdentityRequestModel.deleteMany({ _id: { $in: requests } });
      await MessageModel.deleteMany({ _id: { $in: messages } });
      await UserModel.deleteMany({ _id: { $in: users.map((u) => u._id) } });
    }
    if (client.isReady) {
      for (const user of users) {
        const keys = [];
        for await (const batch of client.scanIterator({ MATCH: userBaseKey({ userId: user._id }) + "::*", COUNT: 100 })) keys.push(...batch);
        if (keys.length) await client.del(keys);
      }
    }
    const assetRoot = resolve("assets") + sep;
    for (const file of uploads) {
      const absolute = resolve(file);
      assert.ok(absolute.startsWith(assetRoot));
      await unlink(absolute);
    }
    console.log("Temporary test data cleaned up");
  } catch (error) {
    console.error("CLEANUP FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    if (client.isOpen) await client.quit();
  }
}
