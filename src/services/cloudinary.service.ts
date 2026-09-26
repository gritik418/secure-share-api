import cloudinary from "../common/config/cloudinary.config.js";
import type { UploadApiResponse } from "cloudinary";

export interface CustomUploadApiResponse extends UploadApiResponse {
  fileName?: string;
  mimetype?: string;
}

export const uploadFileToCloudinary = async (
  file: Express.Multer.File,
): Promise<CustomUploadApiResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "raw", folder: "SecureShare/uploads" },
        (error, result) => {
          if (error) return reject(error);

          const formattedResult: CustomUploadApiResponse = {
            ...(result as UploadApiResponse),
            fileName: file.originalname,
            mimetype: file.mimetype,
          };

          resolve(formattedResult);
        },
      )
      .end(file.buffer);
  });
};
