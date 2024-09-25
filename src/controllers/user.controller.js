import { userModel } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendTaskNotification } from "../helpers/firebaseAdmin.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if ([name, email, password].some((fields) => fields?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await userModel.findOne({ email });

  if (existedUser) {
    throw new ApiError(409, "User with email already exists");
  }

  const user = await userModel.create({
    name,
    email,
    password,
  });

  const createdUser = await userModel.findById(user._id).select("-password");

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const { _id } = req.params;

  const user = await userModel.findOne({ _id });
  if (!user) throw new ApiError(402, "User not found");

  const deletedUser = await userModel.findOneAndDelete({ _id });

  return res
    .status(200)
    .json(new ApiResponse(200, deletedUser, "User deleted successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const { _id } = req.params;

  const user = await userModel.findByIdAndUpdate(_id, {
    name,
    email,
  });

  if (!user) {
    throw new ApiError(402, "User not found");
  } else {
    return res
      .status(200)
      .json(new ApiResponse(200, user, "User updated successfully"));
  }
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((fields) => fields?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await userModel.findOne({ email });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  } else {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Always use secure in production
      sameSite: 'none', // This allows cross-site cookie setting
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res
      .status(200)
      .json(new ApiResponse(200, { user, token }, "User login successfully"));
  }
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "None",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const getUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "User is not authenticated"));
  }

  const user = await userModel
    .findById(req.user._id)
    .populate({
      path: "borrowedBooks.book",
      select: "title author genre image",
    })
    .select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User data retrieved successfully"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await userModel.find({});

  return res
    .status(200)
    .json(new ApiResponse(200, users, "User data got successfully"));
});

const updateFcmToken = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body;
  const userId = req.user._id;

  if (!fcmToken) {
    throw new ApiError(400, "FCM token is required");
  }

  const updatedUser = await userModel
    .findByIdAndUpdate(userId, { fcmToken }, { new: true })
    .select("-password");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "FCM token updated successfully"));
});

export {
  registerUser,
  login,
  logout,
  getUser,
  getAllUsers,
  updateUser,
  deleteUser,
  updateFcmToken,
};
