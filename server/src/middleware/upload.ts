import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config";

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg", ".json"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Multer disk storage configuration.
 * Files are renamed to a UUID to prevent collisions.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

/**
 * File filter that only accepts png, jpg, jpeg, svg, and json.
 */
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${ext}" is not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`));
  }
};

/**
 * Pre-configured multer instance for floor plan uploads.
 * - Max file size: 10 MB
 * - Accepted types: .png, .jpg, .jpeg, .svg, .json
 */
export const planUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});
