import type { Request, Response } from "express";
import raiseServerError from "../common/helpers/raise-server-error.js";
import {
  deleteFileFromCloudinary,
  uploadFileToCloudinary,
  type CustomUploadApiResponse,
} from "../services/cloudinary.service.js";
import prisma from "../database/prisma.js";
import FileUploadSchema from "../schemas/file/upload.schema.js";
import raiseZodError from "../common/helpers/raise-zod-error.js";
import { Readable } from "node:stream";
import { FileVisibility } from "../generated/prisma/enums.js";
import AddFileMemberSchema from "../schemas/file/add-member.schema.js";
import RemoveFileMemberSchema from "../schemas/file/remove-member.schema.js";

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
      const createdFile = await prisma.file.create({
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

      const accessLink = `${process.env.BASE_URL!}/api/file/${createdFile.id}/view`;

      return res.status(200).json({
        success: true,
        message: "File uploaded successfully.",
        data: {
          accessLink,
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

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    const visibility =
      req.query.visibility === FileVisibility.PRIVATE ||
      req.query.visibility === FileVisibility.ANYONE_WITH_LINK
        ? (req.query.visibility as FileVisibility)
        : undefined;

    const skip = (page - 1) * limit;

    const where = {
      ownerId: userId,

      ...(search
        ? {
            originalName: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),

      ...(visibility
        ? {
            visibility,
          }
        : {}),
    };

    const [files, total] = await prisma.$transaction([
      prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          shares: {
            select: {
              email: true,
            },
          },
        },
      }),

      prisma.file.count({
        where,
      }),
    ]);

    const formattedFiles = files.map((file) => {
      const accessLink = `${process.env.BASE_URL!}/api/file/${file.id}/view`;

      const formattedFile = {
        ...file,
        size: file.size.toString(),
        accessLink,
      };
      return formattedFile;
    });

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Files fetched successfully.",
      data: {
        files: formattedFiles,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const accessFile = async (req: Request, res: Response) => {
  try {
    const fileId: string | undefined | string[] = req.params.id;
    const userId: string | undefined = req.user?.id;
    const userEmail: string | undefined = req.user?.email;

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
      return res.redirect(`${process.env.CLIENT_URL}/file-unavailable`);
    }

    if (file.visibility === "PRIVATE" && (!userId || !userEmail)) {
      return res.redirect(`${process.env.CLIENT_URL}/file-unavailable`);
    }

    if (file.visibility === "PRIVATE" && file.ownerId !== userId) {
      if (!userEmail) {
        return res.redirect(`${process.env.CLIENT_URL}/file-unavailable`);
      }

      const isShared = await prisma.fileShare.findFirst({
        where: {
          fileId: fileId,
          email: userEmail,
        },
      });

      if (!isShared) {
        return res.redirect(`${process.env.CLIENT_URL}/file-unavailable`);
      }
    }

    const response = await fetch(file.fileUrl);

    if (!response.ok || !response.body) {
      return res.redirect(`${process.env.CLIENT_URL}/file-unavailable`);
    }

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );

    Readable.fromWeb(response.body as any).pipe(res);
  } catch (error) {
    if (res.headersSent) {
      console.error("Error while streaming file:", error);
      return;
    }

    return raiseServerError(res, error);
  }
};

export const downloadFile = async (req: Request, res: Response) => {
  try {
    const fileId: string | undefined | string[] = req.params.id;
    const userId: string | undefined = req.user?.id;
    const userEmail: string | undefined = req.user?.email;

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

    if (file.visibility === "PRIVATE" && (!userId || !userEmail)) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (file.visibility === "PRIVATE" && file.ownerId !== userId) {
      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
      }

      const isShared = await prisma.fileShare.findFirst({
        where: {
          fileId: fileId,
          email: userEmail,
        },
      });

      if (!isShared) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this file.",
        });
      }
    }

    const response = await fetch(file.fileUrl);

    if (!response.ok || !response.body) {
      return res.status(404).json({
        success: false,
        message: "File could not be retrieved.",
      });
    }

    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );

    Readable.fromWeb(response.body as any).pipe(res);
  } catch (error) {
    if (res.headersSent) {
      console.error("Error while streaming file:", error);
      return;
    }

    return raiseServerError(res, error);
  }
};

export const getReceivedFiles = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;
    const userEmail: string | undefined = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : undefined;

    const skip = (page - 1) * limit;

    const where = {
      shares: {
        some: {
          email: userEmail,
        },
      },

      ...(search
        ? {
            originalName: {
              contains: search,
              mode: "insensitive" as const,
            },
          }
        : {}),
    };

    const [files, total] = await prisma.$transaction([
      prisma.file.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      prisma.file.count({
        where,
      }),
    ]);

    const formattedFiles = files.map((file) => ({
      ...file,
      size: file.size.toString(),
    }));

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: "Received files fetched successfully.",
      data: {
        files: formattedFiles,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const fileId: string | undefined | string[] = req.params.id;
    const userId: string | undefined = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (typeof fileId !== "string") {
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

    if (file.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this file.",
      });
    }

    const isDeleted: boolean = await deleteFileFromCloudinary(file.publicId);

    if (!isDeleted) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete file from cloud storage.",
      });
    }

    await prisma.file.delete({
      where: {
        id: fileId,
      },
    });

    await prisma.fileShare.deleteMany({
      where: {
        fileId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "File deleted successfully.",
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const addFileMember = async (req: Request, res: Response) => {
  try {
    const userId: string | undefined = req.user?.id;
    const fileId: string | undefined | string[] = req.params?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

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

    if (file.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to add members to this file.",
      });
    }

    const rawData = req.body;

    const result = AddFileMemberSchema.safeParse(rawData);

    if (!result.success) {
      return raiseZodError(result.error, res);
    }

    const { email } = result.data;

    const isAlreadyShared = await prisma.fileShare.findFirst({
      where: {
        fileId: fileId,
        email: email,
      },
    });

    if (isAlreadyShared) {
      return res.status(400).json({
        success: false,
        message: "User is already added to the file.",
      });
    }

    const fileShare = await prisma.fileShare.create({
      data: {
        email,
        fileId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Member added successfully.",
      data: {
        fileShare,
      },
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};

export const removeFileMember = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const fileId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

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

    if (file.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to remove member from this file.",
      });
    }

    const result = RemoveFileMemberSchema.safeParse(req.body);

    if (!result.success) {
      return raiseZodError(result.error, res);
    }

    const { email } = result.data;

    const fileShare = await prisma.fileShare.findUnique({
      where: {
        fileId_email: {
          fileId,
          email,
        },
      },
    });

    if (!fileShare) {
      return res.status(400).json({
        success: false,
        message: "User is not a member of this file.",
      });
    }

    await prisma.fileShare.delete({
      where: {
        fileId_email: {
          fileId,
          email,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Member removed successfully.",
    });
  } catch (error) {
    return raiseServerError(res, error);
  }
};
