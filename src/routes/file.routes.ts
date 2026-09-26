import { Router } from "express";
import authenticate from "../middlewares/auth.middleware.js";
import { uploadFile } from "../controllers/file.controller.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const router = Router();

router.post("/upload", authenticate, upload.single("file"), uploadFile);

export default router;
