import type { NextFunction, Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import AUTH_COOKIE_NAME from "../common/constants/cookie.constants.js";
import jwt from "jsonwebtoken";
import type { JWT_Payload } from "../controllers/auth.controller.js";

declare module "express" {
  interface Request {
    user?: JWT_Payload;
  }
}

const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authToken = req.cookies[AUTH_COOKIE_NAME];

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

export default authenticate;
