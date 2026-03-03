import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { notFound, errorHandler } from "./middlewares/error";
import apiRoutes from "./routes";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };
export default app;
