import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { userRouter } from "./routers/user.router.js";
import path from "path";
import { fileURLToPath } from "url";

import admin from "firebase-admin";
import { expenseRouter } from "./routers/expense.router.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  // private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  private_key: process.env.FIREBASE_PRIVATE_KEY,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.get("/firebase-messaging-sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "../public/firebase-messaging-sw.js"));
});

//default routers
app.get("/", (req, res) => {
  res.send("welcome!");
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/expenses", expenseRouter);

app.get("/test-redis", async (req, res) => {
  try {
    await redisClient.set("test", "Hello Redis");
    const value = await redisClient.get("test");
    res.send(`Redis is working. Test value: ${value}`);
  } catch (error) {
    res.status(500).send(`Redis error: ${error.message}`);
  }
});

// app.use((err, req, res, next) => {
//   console.error('Error details:', err);
//   res.status(err.status || 500).json({
//     success: false,
//     message: err.message,
//     stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
//   });
// });

export { app };
