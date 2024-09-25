import { userModel } from "../models/user.model.js";
import jwt from "jsonwebtoken";

const isAuth = async (req, res, next) => {
  try {
    const token =
      req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      req.user = null;
      return next();
    }

    const { id } = await jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findOne({ _id: id });

    if (!user) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export { isAuth };
