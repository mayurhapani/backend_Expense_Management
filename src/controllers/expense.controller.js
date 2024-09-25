import { Expense } from "../models/expense.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parse } from "csv-parse/sync";
import redisClient from "../config/redis.js";

const addExpense = asyncHandler(async (req, res) => {
  const { amount, description, date, category, paymentMethod } = req.body;
  const userId = req.user._id;

  if (!amount || !description || !date || !category || !paymentMethod) {
    throw new ApiError(400, "All fields are required");
  }

  const expense = await Expense.create({
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

  const expenses = await Expense.find(query)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Expense.countDocuments(query);

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

  const expense = await Expense.findOneAndUpdate(
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

  const expense = await Expense.findOneAndDelete({ _id: id, user: userId });

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

  const statistics = await Expense.aggregate([
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
  });

  const expenses = records.map((record) => ({
    user: userId,
    amount: parseFloat(record.amount),
    description: record.description,
    date: new Date(record.date),
    category: record.category,
    paymentMethod: record.paymentMethod,
  }));

  const result = await Expense.insertMany(expenses);

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

  const result = await Expense.deleteMany({
    _id: { $in: ids },
    user: userId,
  });

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
    const totalExpenses = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // Get top expense categories
    const categories = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
      { $limit: 3 },
      { $project: { _id: 0, name: "$_id", total: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalExpenses: totalExpenses[0]?.total || 0,
        categories: categories
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching expense summary",
      error: error.message
    });
  }
};

export {
  addExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  getExpenseStatistics,
  bulkUploadExpenses,
  bulkDeleteExpenses,
  getExpenseSummary,
};
