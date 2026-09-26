import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);

app.listen(port, () => {
  console.log(`App served at port: ${port}`);
});
