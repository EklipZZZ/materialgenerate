import express from "express";
import cors from "cors";
import multer from "multer";
import { env } from "./env.js";
import { generateRouter } from "./routes/generate.js";
import { enrichRouter } from "./routes/enrich.js";
import { llmConfigsRouter } from "./routes/llm-configs.js";
import { generationRecordsRouter } from "./routes/generation-records.js";
import { applicationsRouter } from "./routes/applications.js";
import { aiRateLimit, apiRateLimit } from "./rate-limit.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error("Origin is not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
}));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_request, response) => response.json({ ok: true }));
app.get("/", (_request, response) => response.json({ service: "materialgenerate-server", ok: true }));
app.use("/api", apiRateLimit);
app.use("/api/enrich", aiRateLimit);
app.use("/api/generate", aiRateLimit);
app.use("/api/applications", applicationsRouter);
app.use("/api/llm-configs", llmConfigsRouter);
app.use("/api/enrich", enrichRouter);
app.use("/api/generate", generateRouter);
app.use("/api/generation-records", generationRecordsRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next;
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json({ code: 413, msg: "源码压缩包不能超过 100 MB", data: null });
    return;
  }
  response.status(500).json({ code: 500, msg: "服务器内部错误", data: null });
});

app.listen(env.port, "0.0.0.0", () => {
  console.log("materialgenerate server listening on port " + env.port);
});
