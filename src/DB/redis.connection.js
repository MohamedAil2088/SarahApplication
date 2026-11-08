import { createClient } from "redis"
import { REDIS_URI } from "../config.js";

export const client = createClient({
  url: REDIS_URI,
});

client.on('error', (err) => console.log('Redis Client Error ❌', err));

export async function connectRedis() {
  if (!client.isOpen) {
    try {
      await client.connect();
      console.log('Redis connected successfully 👌');
    } catch (error) {
      console.log('Fail to connect on Redis ❌', error);
    }
  }
}

await connectRedis();
