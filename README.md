# Expense Management Web App Backend

This repository contains the backend implementation for an Expense Management Web Application. It provides a RESTful API for managing expenses, user authentication, and generating expense statistics.

## Live Demo

Backend API URL: https://backend-expense-management.onrender.com

## GitHub Repository

https://github.com/mayurhapani/backend_Expense_Management.git

## Features

- User authentication and authorization with JWT
- CRUD operations for expenses
- Bulk upload and deletion of expenses
- Advanced filtering, sorting, and pagination for expenses
- Expense statistics generation using MongoDB aggregation
- Role-based access control (RBAC)
- Redis caching for improved performance

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Redis
- JWT for authentication
- Bcrypt for password hashing

## Prerequisites

- Node.js (v14 or later)
- MongoDB
- Redis

## Setup and Installation

1. Clone the repository:

   ```
   git clone [Your GitHub Repository URL]
   cd swiftrut-task8-backend
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following variables:

   ```
   PORT=8001
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   REDIS_URL=your_redis_url
   ```

4. Start the server:
   ```
   npm start
   ```

## API Endpoints

### User Routes

- POST `/api/v1/users/register` - Register a new user
- POST `/api/v1/users/login` - User login
- GET `/api/v1/users/logout` - User logout
