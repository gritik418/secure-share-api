import type { Response } from "express";

const raiseServerError = (res: Response, error?: any): Response => {
  console.log(error);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
};

export default raiseServerError;
