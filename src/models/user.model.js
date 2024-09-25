import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin"],
    },
    fcmToken: {
      type: String,
      default: "",
    },
    borrowedBooks: [
      {
        book: {
          type: Schema.Types.ObjectId,
          ref: "Book",
        },
        borrowDate: Date,
        returnDate: Date,
      },
    ],
  },
  { timestamps: true }
);

const borrowedBookSchema = new Schema({
  book: {
    type: Schema.Types.ObjectId,
    ref: "Book",
    required: true,
  },
  borrowDate: {
    type: Date,
    default: Date.now,
  },
  returnDate: {
    type: Date,
    required: true,
  },
});

userSchema.add({
  borrowedBooks: [borrowedBookSchema],
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.TOKEN_SECRET,
    { expiresIn: process.env.TOKEN_EXPIRY }
  );
};

export const userModel = mongoose.model("User", userSchema);
