import type { Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import RegisterSchema from "../schemas/register.schema.js";
import raiseZodError from "../common/helpers/raise-zod-error.js";
import prisma from "../database/prisma.js";
import { hashValue } from "../common/utils/hashing.util.js";

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
