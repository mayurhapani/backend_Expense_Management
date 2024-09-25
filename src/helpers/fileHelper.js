import fs from "fs";
import path from "path";
import csvParser from "csv-parser";
import { ApiError } from "../utils/apiError.js";

export const readCSVFile = async (filePath) => {
  const tasks = [];

  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(filePath)) {
        return reject(new ApiError(404, "File not found"));
      }

      const parser = fs.createReadStream(filePath).pipe(csvParser());

      parser.on("data", (row) => {
        tasks.push(row);
      });

      parser.on("end", () => {
        resolve(tasks);
      });

      parser.on("error", (error) => {
        reject(new ApiError(500, "Error parsing CSV file"));
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting the uploaded file:", err);
    }
  });
};
