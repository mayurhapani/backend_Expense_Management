import { createClient } from "redis";

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_URL,
    port: process.env.REDIS_PORT,
  },
});

// const redisClient = createClient({
//   url: process.env.REDIS_URL
// });

redisClient.on("error", (err) => console.log("Redis Client Error", err));

await redisClient.connect();

export default redisClient;
