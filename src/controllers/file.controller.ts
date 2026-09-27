import type { Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import {
  uploadFileToCloudinary,
  type CustomUploadApiResponse,
} from "../services/cloudinary.service.js";
import prisma from "../database/prisma.js";
import FileUploadSchema from "../schemas/file/upload.schema.js";
import raiseZodError from "../common/helpers/raise-zod-error.js";

export const uploadFile = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    const rawData = req.body;

    const result = FileUploadSchema.safeParse(rawData);

    if (!result.success) {
      return raiseZodError(result.error, res);
    }

    const { visibility, mails } = result.data;

    const uploaded: CustomUploadApiResponse =
      await uploadFileToCloudinary(file);

    if (!uploaded.secure_url) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload file.",
      });
    }

    if (visibility === "PRIVATE") {
      if (!mails || mails.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one email is required for private files.",
        });
      }

      await prisma.$transaction(async (txn) => {
        const createdFile = await txn.file.create({
          data: {
            name: uploaded.fileName || file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,

            fileUrl: uploaded.secure_url,
            publicId: uploaded.public_id,

            ownerId: userId,
            visibility,
          },
        });

        const fileShares = [];
        for (let email of mails) {
          const file = {
            email,
            fileId: createdFile.id,
          };

          fileShares.push(file);
        }

        await txn.fileShare.createMany({
          data: fileShares,
        });
      });
    } else {
      await prisma.file.create({
        data: {
          name: uploaded.fileName || file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,

          fileUrl: uploaded.secure_url,
          publicId: uploaded.public_id,

          ownerId: userId,
          visibility,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully.",
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const getMyFiles = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const files = await prisma.file.findMany({
      where: {
        ownerId: userId,
      },
    });

    const formattedFiles = files.map((file) => ({
      ...file,
      size: file.size.toString(),
    }));

    return res.status(200).json({
      success: true,
      message: "Files fetched successfully.",
      data: {
        files: formattedFiles,
      },
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};
