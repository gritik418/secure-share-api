import { Router } from "express";
import multer from "multer";
import {
  accessFile,
  addFileMember,
  deleteFile,
  downloadFile,
  getMyFiles,
  getReceivedFiles,
  removeFileMember,
  uploadFile,
} from "../controllers/file.controller.js";
import authenticate from "../middlewares/auth.middleware.js";
import fileAccessMiddleware from "../middlewares/fileAccess.middleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/zip",
      "application/x-zip-compressed",
      "video/mp4",
      "audio/mpeg",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("This file type is not allowed."));
    }
  },
});

const router = Router();

router.post("/upload", authenticate, upload.single("file"), uploadFile);

router.get("/", authenticate, getMyFiles);

router.get("/received", authenticate, getReceivedFiles);

router.get("/:id/view", fileAccessMiddleware, accessFile);

router.get("/:id/download", fileAccessMiddleware, downloadFile);

router.delete("/:id", authenticate, deleteFile);

router.post("/:id/members", authenticate, addFileMember);

router.delete("/:id/members", authenticate, removeFileMember);

export default router;
