import type { Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import RegisterSchema from "../schemas/auth/register.schema.js";
import raiseZodError from "../common/helpers/raise-zod-error.js";
import prisma from "../database/prisma.js";
import { compareValue, hashValue } from "../common/utils/hashing.util.js";
import LoginSchema from "../schemas/auth/login.schema.js";
import jwt from "jsonwebtoken";
import AUTH_COOKIE_NAME from "../common/constants/cookie.constants.js";
import COOKIE_OPTIONS from "../common/config/cookie.config.js";

export type JWT_Payload = {
  id: string;
  email: string;
};

export const register = async (req: Request, res: Response) => {
  try {
    const rawData = req.body;

    const result = RegisterSchema.safeParse(rawData);

    if (!result.success) {
      return raiseZodError(result.error, res);
    }

    const { name, email, password } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists.",
      });
    }

    const hashedPassword: string = await hashValue(password);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const rawData = req.body;

    const result = LoginSchema.safeParse(rawData);

    if (!result.success) {
      return raiseZodError(result.error, res);
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const isPasswordValid = await compareValue(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
    }

    const payload: JWT_Payload = {
      id: user.id,
      email: user.email,
    };

    const token: string = jwt.sign(payload, process.env.JWT_SECRET!);

    return res
      .status(200)
      .cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS)
      .json({
        success: true,
        message: "User logged in successfully.",
      });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const [uploadedFilesCount, sharedToMeCount, sharedByMeCount] =
      await Promise.all([
        prisma.file.count({
          where: {
            ownerId: userId,
          },
        }),
        prisma.fileShare.count({
          where: {
            email: user?.email,
          },
        }),
        prisma.fileShare.groupBy({
          by: ["fileId"],
          where: {
            file: {
              ownerId: userId,
            },
          },
        }),
      ]);

    return res.status(200).json({
      success: true,
      message: "User fetched successfully.",
      data: {
        user: {
          ...user,
          uploadedFilesCount,
          sharedToMeCount,
          sharedByMeCount: sharedByMeCount.length,
        },
      },
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    return res.status(200).clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS).json({
      success: true,
      message: "User logged out successfully.",
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};
