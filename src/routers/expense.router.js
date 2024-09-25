import { Router } from "express";
import {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseStatistics,
  bulkUploadExpenses,
  bulkDeleteExpenses,
} from "../controllers/expense.controller.js";
import { isAuth } from "../middlewares/isAuth.middleware.js";
import { authorize } from "../middlewares/rbac.middleware.js";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
const expenseRouter = Router();

expenseRouter.use(isAuth);

expenseRouter.post("/", addExpense);
expenseRouter.get("/", getExpenses);
expenseRouter.get("/statistics", getExpenseStatistics);
expenseRouter.patch("/:id", updateExpense);
expenseRouter.delete("/:id", deleteExpense);
expenseRouter.post("/bulk-upload", upload.single("file"), bulkUploadExpenses);
expenseRouter.post("/bulk-delete", authorize("admin"), bulkDeleteExpenses);

export { expenseRouter };
