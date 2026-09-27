import { Router } from "express";
import authenticate from "../middlewares/auth.middleware.js";
import {
  accessFile,
  downloadFile,
  getMyFiles,
  getReceivedFiles,
  uploadFile,
} from "../controllers/file.controller.js";
import multer from "multer";
import fileAccessMiddleware from "../middlewares/fileAccess.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const router = Router();

router.post("/upload", authenticate, upload.single("file"), uploadFile);

router.get("/", authenticate, getMyFiles);

router.get("/:id", fileAccessMiddleware, accessFile);

router.get("/:id/download", fileAccessMiddleware, downloadFile);

router.get("/received", authenticate, getReceivedFiles);

export default router;
