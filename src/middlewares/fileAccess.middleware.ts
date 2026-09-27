import type { NextFunction, Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import AUTH_COOKIE_NAME from "../common/constants/cookie.constants.js";
import jwt from "jsonwebtoken";
import type { JWT_Payload } from "../controllers/auth.controller.js";
import prisma from "../database/prisma.js";

declare module "express" {
  interface Request {
    user?: JWT_Payload;
  }
}

const fileAccessMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authToken = req.cookies[AUTH_COOKIE_NAME];
    const fileId: string | undefined | string[] = req.params.id;

    if (!fileId || typeof fileId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid file ID.",
      });
    }

    const file = await prisma.file.findUnique({
      where: {
        id: fileId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
      });
    }

    if (file.visibility === "ANYONE_WITH_LINK") {
      return next();
    }

    if (!authToken) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }
    const payload = jwt.verify(
      authToken,
      process.env.JWT_SECRET!,
    ) as JWT_Payload;

    if (!payload || !payload.id || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
    };

    next();
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export default fileAccessMiddleware;
