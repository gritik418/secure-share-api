import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import fileRoutes from "./routes/file.routes.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: [process.env.CLIENT_URL!],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/file", fileRoutes);

app.listen(port, () => {
  console.log(`App served at port: ${port}`);
});
