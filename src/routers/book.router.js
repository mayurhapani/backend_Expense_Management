import { Router } from "express";
import {
  addBook,
  updateBook,
  deleteBook,
  getAllBooks,
  getBookDetails,
  borrowBook,
  returnBook,
} from "../controllers/book.controller.js";
import { isAuth } from "../middlewares/isAuth.middleware.js";

const bookRouter = Router();

// Public routes
bookRouter.get("/", getAllBooks);
bookRouter.get("/:id", getBookDetails);

// Protection
bookRouter.use(isAuth);

// Protected routes
bookRouter.post("/", addBook);
bookRouter.put("/:id", updateBook);
bookRouter.delete("/:id", deleteBook);
bookRouter.post("/:bookId/borrow", borrowBook);
bookRouter.post("/:bookId/return", returnBook);

export { bookRouter };
