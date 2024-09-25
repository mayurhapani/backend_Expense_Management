import { bookModel } from "../models/book.model.js";
import { userModel } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const addBook = asyncHandler(async (req, res) => {
  const {
    title,
    author,
    genre,
    publicationDate,
    description,
    image,
    availableCopies,
  } = req.body;

  if (
    [title, author, genre, publicationDate, image, description].some(
      (field) => field?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const newBook = await bookModel.create({
    title,
    author,
    genre,
    description,
    publicationDate,
    image,
    availableCopies: availableCopies || 1,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newBook, "Book added successfully"));
});

const updateBook = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    author,
    genre,
    publicationDate,
    image,
    availableCopies,
    description,
  } = req.body;

  const book = await bookModel.findByIdAndUpdate(
    id,
    {
      title,
      author,
      genre,
      description,
      publicationDate,
      image,
      availableCopies,
    },
    { new: true }
  );

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, book, "Book updated successfully"));
});

const deleteBook = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const book = await bookModel.findByIdAndDelete(id);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Book deleted successfully"));
});

const getAllBooks = asyncHandler(async (req, res) => {
  const { genre, author, publicationDate, search } = req.query;
  const filter = {};

  if (genre) filter.genre = genre;
  if (author) filter.author = { $regex: author, $options: "i" };
  if (publicationDate) filter.publicationDate = publicationDate;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { author: { $regex: search, $options: "i" } },
    ];
  }

  const books = await bookModel.find(filter);

  return res
    .status(200)
    .json(new ApiResponse(200, books, "Books retrieved successfully"));
});

const getBookDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const book = await bookModel.findById(id);

  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, book, "Book details retrieved successfully"));
});

const borrowBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { returnDate } = req.body;
  const userId = req.user._id;

  const book = await bookModel.findById(bookId);
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  if (book.availableCopies < 1) {
    throw new ApiError(400, "No copies available for borrowing");
  }

  const user = await userModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const borrowDate = new Date();
  const maxReturnDate = new Date(
    borrowDate.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  if (new Date(returnDate) > maxReturnDate) {
    throw new ApiError(
      400,
      "Return date cannot be more than 7 days from borrowing date"
    );
  }

  user.borrowedBooks.push({
    book: bookId,
    borrowDate,
    returnDate,
  });

  book.availableCopies -= 1;

  await user.save();
  await book.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { book, user }, "Book borrowed successfully"));
});

const returnBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const userId = req.user._id;

  const user = await userModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const borrowedBookIndex = user.borrowedBooks.findIndex(
    (item) => item.book.toString() === bookId
  );

  if (borrowedBookIndex === -1) {
    throw new ApiError(400, "Book not borrowed by this user");
  }

  const book = await bookModel.findById(bookId);
  if (!book) {
    throw new ApiError(404, "Book not found");
  }

  user.borrowedBooks.splice(borrowedBookIndex, 1);
  book.availableCopies += 1;

  await user.save();
  await book.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { book, user }, "Book returned successfully"));
});

export {
  addBook,
  updateBook,
  deleteBook,
  getAllBooks,
  getBookDetails,
  borrowBook,
  returnBook,
};
