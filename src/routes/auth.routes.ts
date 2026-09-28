import { Router } from "express";
import {
  getMe,
  login,
  logout,
  register,
} from "../controllers/auth.controller.js";
import authenticate from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", register);

router.post("/login", login);

router.get("/me", authenticate, getMe);

router.post("/logout", authenticate, logout);

export default router;
