import { expenseModel } from "../models/expense.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import redisClient from "../config/redis.js";
import { parse as parseDate } from "date-fns";

const addExpense = asyncHandler(async (req, res) => {
  try {
    const { amount, description, date, category, paymentMethod } = req.body;

    const userId = req.user._id;

    if (!amount || !description || !date || !category || !paymentMethod) {
      throw new ApiError(400, "All fields are required");
    }

    const expense = await expenseModel.create({
      user: userId,
      amount,
      description,
      date,
      category,
      paymentMethod,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, expense, "Expense added successfully"));
  } catch (error) {
    console.error("Error in addExpense:", error);
    throw new ApiError(500, "Failed to add expense: " + error.message);
  }
});

const getExpenses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    category,
    startDate,
    endDate,
    paymentMethod,
    page = 1,
    limit = 10,
  } = req.query;

  const cacheKey = `expenses:${userId}:${JSON.stringify(req.query)}`;
  const cachedResult = await redisClient.get(cacheKey);

  if (cachedResult) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          JSON.parse(cachedResult),
          "Expenses retrieved from cache"
        )
      );
  }

  const query = { user: userId };
  if (category) query.category = category;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const expenses = await expenseModel
    .find(query)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await expenseModel.countDocuments(query);

  const result = {
    expenses,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };

  // Cache the result for 5 minutes
  await redisClient.setEx(cacheKey, 300, JSON.stringify(result));

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Expenses retrieved successfully"));
});

const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, description, date, category, paymentMethod } = req.body;
  const userId = req.user._id;

  const expense = await expenseModel.findOneAndUpdate(
    { _id: id, user: userId },
    { amount, description, date, category, paymentMethod },
    { new: true }
  );

  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, expense, "Expense updated successfully"));
});

const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const expense = await expenseModel.findOneAndDelete({
    _id: id,
    user: userId,
  });

  if (!expense) {
    throw new ApiError(404, "Expense not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Expense deleted successfully"));
});

const getExpenseStatistics = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { startDate, endDate } = req.query;

  const matchStage = {
    user: userId,
    date: {
      $gte: new Date(startDate || "1970-01-01"),
      $lte: new Date(endDate || new Date()),
    },
  };

  const statistics = await expenseModel.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalExpenses: { $sum: "$amount" },
        averageExpense: { $avg: "$amount" },
        expensesByCategory: {
          $push: {
            category: "$category",
            amount: "$amount",
          },
        },
        expensesByMonth: {
          $push: {
            month: { $month: "$date" },
            year: { $year: "$date" },
            amount: "$amount",
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalExpenses: 1,
        averageExpense: 1,
        expensesByCategory: {
          $reduce: {
            input: "$expensesByCategory",
            initialValue: {},
            in: {
              $mergeObjects: [
                "$$value",
                {
                  "$$this.category": {
                    $sum: ["$$value.$$this.category", "$$this.amount"],
                  },
                },
              ],
            },
          },
        },
        expensesByMonth: {
          $reduce: {
            input: "$expensesByMonth",
            initialValue: {},
            in: {
              $mergeObjects: [
                "$$value",
                {
                  $let: {
                    vars: {
                      monthYear: {
                        $concat: [
                          { $toString: "$$this.year" },
                          "-",
                          { $toString: "$$this.month" },
                        ],
                      },
                    },
                    in: {
                      $mergeObjects: [
                        "$$value",
                        {
                          $$monthYear: {
                            $sum: [
                              { $ifNull: ["$$value.$$monthYear", 0] },
                              "$$this.amount",
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        statistics[0] || {},
        "Expense statistics retrieved successfully"
      )
    );
});

const bulkUploadExpenses = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "CSV file is required");
  }

  const userId = req.user._id;
  const csvData = req.file.buffer.toString();

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  }).filter((record) =>
    Object.values(record).some((value) => value.trim() !== "")
  );

  const validExpenses = [];
  const errors = [];

  records.forEach((record, index) => {
    const rowErrors = [];
    const amount = parseFloat(record.amount);
    let date;
    try {
      date = parseDate(record.date, "M/d/yyyy", new Date());
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (error) {
      rowErrors.push("Invalid date format. Use M/D/YYYY");
    }
    if (isNaN(amount)) {
      rowErrors.push("Invalid amount");
    }
    if (!record.description) {
      rowErrors.push("Description is required");
    }
    if (!record.category) {
      rowErrors.push("Category is required");
    }
    if (!record.paymentMethod) {
      rowErrors.push("Payment method is required");
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${index + 2}: ${rowErrors.join(", ")}`);
    } else if (
      amount &&
      date &&
      record.description &&
      record.category &&
      record.paymentMethod
    ) {
      validExpenses.push({
        user: userId,
        amount,
        description: record.description,
        date,
        category: record.category,
        paymentMethod: record.paymentMethod,
      });
    }
  });

  if (errors.length > 0) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          { errors, validCount: validExpenses.length },
          "Validation errors in CSV data"
        )
      );
  }

  if (validExpenses.length === 0) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "No valid expenses found in CSV"));
  }

  const result = await expenseModel.insertMany(validExpenses);

  // Invalidate cache
  const cacheKeys = await redisClient.keys(`expenses:${userId}:*`);
  if (cacheKeys.length > 0) {
    await redisClient.del(cacheKeys);
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result,
        `${result.length} expenses uploaded successfully`
      )
    );
});

const bulkDeleteExpenses = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const userId = req.user._id;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError(400, "Valid expense IDs are required");
  }

  const result = await expenseModel.deleteMany({
    _id: { $in: ids },
    user: userId,
  });

  // Invalidate cache
  const cacheKeys = await redisClient.keys(`expenses:${userId}:*`);
  if (cacheKeys.length > 0) {
    await redisClient.del(cacheKeys);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result,
        `${result.deletedCount} expenses deleted successfully`
      )
    );
});

const getExpenseSummary = async (req, res) => {
  try {
    const userId = req.user._id; // Assuming you have user authentication middleware

    // Get total expenses
    const totalExpenses = await expenseModel.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Get top expense categories
    const categories = await expenseModel.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 3 },
      { $project: { _id: 0, name: "$_id", total: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalExpenses: totalExpenses[0]?.total || 0,
        categories: categories,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching expense summary",
      error: error.message,
    });
  }
};

const exportExpenses = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const expenses = await expenseModel.find({ user: userId }).sort({ date: -1 });

  const csvData = stringify(
    expenses.map((expense) => ({
      amount: expense.amount,
      description: expense.description,
      date: expense.date.toISOString().split("T")[0], // Format date as YYYY-MM-DD
      category: expense.category,
      paymentMethod: expense.paymentMethod,
    })),
    {
      header: true,
      columns: ["amount", "description", "date", "category", "paymentMethod"],
    }
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=expenses.csv");

  return res.status(200).send(csvData);
});

export {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseStatistics,
  bulkUploadExpenses,
  bulkDeleteExpenses,
  getExpenseSummary,
  exportExpenses,
};
