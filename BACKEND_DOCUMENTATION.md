# Backend Documentation

This project is a Node.js + Express backend for a simple e-commerce or product/order management API. It uses MongoDB with Mongoose for persistence and JWT-based authentication to protect user and admin routes.

## 1. Stack and Tools

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT (JSON Web Tokens)
- bcryptjs for password hashing
- dotenv for environment handling
- nodemon for local development

## 2. Project Overview

The backend exposes REST API endpoints for:

- user registration and login
- viewing products
- creating customer orders
- viewing a user’s own orders
- managing promotional offers
- validating and applying offers to orders
- admin-only product management
- admin-only order status management
- admin-only offer management

## 3. Main Entry Point

The server starts in `server.js`.

Key behavior:

- loads environment variables via `dotenv`
- connects to MongoDB using `connectDB()`
- sets up Express JSON parsing
- defines the base route `/`
- mounts route modules under `/api/*`
- starts the server on `process.env.PORT`

### Server file summary

- `server.js`
  - starts Express app
  - connects DB
  - registers routes
  - mounts `/api/offers` public offer routes
  - mounts `/api/admin` admin-only routes
  - listens on configured port

## 4. Environment Configuration

The backend expects environment variables in a `.env` file, including:

```env
PORT=5000
JWT_SECRET=your_secret_key
MONGO_URI=your_mongodb_connection_string
```

Important:

- `JWT_SECRET` is used to sign and verify JWTs.
- `MONGO_URI` connects the app to MongoDB.
- `PORT` is the server port.
- S3 environment variables such as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_BUCKET_NAME` were removed for the local upload setup.

## 5. Database Connection

The MongoDB connection logic lives in `config/db.js`.

Functionality:

- connects to MongoDB using Mongoose
- uses `serverSelectionTimeoutMS: 10000`
- logs success or failure
- exits the process on failure

This ensures the app does not run without a valid database connection.

## 6. Models

### User Model (`models/User.js`)

Fields:

- `name`
- `email` (unique)
- `password`
- `role` (`user` or `admin`, default: `user`)

Behavior:

- password is automatically hashed before save using `bcryptjs`
- only hashes when the password field is modified

### Product Model (`models/Product.js`)

Fields:

- `name`
- `description`
- `price`
- `image`
- `stock`
- `isActive` (default: `true`)

### Offer Model (`models/Offer.js`)

Fields:

- `code` → required, unique, uppercase string
- `description`
- `discountType` → `percentage` or `fixed`
- `discountValue` → numeric value used for the discount
- `minOrderAmount` → minimum order required to apply the offer
- `maxDiscountAmount` → optional cap for percentage discounts
- `applicableProducts` → array of Product references; empty means applies to all products
- `startDate`
- `endDate`
- `usageLimit` → optional global usage cap
- `usedCount` → number of times the offer has been used
- `isActive` → default `true`
- timestamps (`createdAt`, `updatedAt`)

### Order Model (`models/Order.js`)

Fields:

- `user` → reference to `User`
- `products` → array of objects with:
  - `product` → reference to `Product`
  - `quantity`
- `offerCode` → optional applied promo code
- `discountAmount` → total discount saved on the order
- `totalPrice` → final price after discount
- `paymentMethod` (default: `Cash On Delivery`)
- `status` (`pending`, `shipped`, `delivered`)
- `address`
- `phone`
- timestamps (`createdAt`, `updatedAt`)

## 7. Authentication and Authorization

### JWT Token Generator (`utils/generateToken.js`)

Creates a JWT with:

- payload: `{ id: user._id, role: user.role }`
- secret from `process.env.JWT_SECRET`
- expiration: `7d`

### Auth Middleware (`middleware/auth.js`)

This middleware:

- reads the bearer token from the `Authorization` header
- verifies the token using JWT
- loads the user from MongoDB
- attaches the user to `req.user`
- rejects requests with `401` if token is missing or invalid

### Admin Middleware (`middleware/admin.js`)

This checks whether the logged-in user has role `admin`.

- if `req.user.role !== "admin"` → returns `403`
- otherwise passes control to the next handler

## 8. Routes

### Auth Routes (`routes/authRoutes.js`)

- `POST /api/auth/register`
  - creates a new user
- `POST /api/auth/login`
  - verifies email/password
  - returns JWT token and user data

### Product Routes (`routes/productRoutes.js`)

- `GET /api/products`
  - returns active products only
- `GET /api/products/:id`
  - returns a single product by ID

### Offer Routes (`routes/offerRoutes.js`)

- `GET /api/offers/active`
  - public endpoint
  - returns currently valid offers
- `POST /api/offers/validate`
  - requires authentication
  - validates a code against a provided `totalPrice`
  - returns discount amount and final price

### Order Routes (`routes/orderRoutes.js`)

- `POST /api/orders`
  - requires authentication
  - creates an order for the logged-in user
  - re-validates `offerCode` server-side before finalizing the order
- `GET /api/orders/my`
  - requires authentication
  - returns all orders for the logged-in user

### Admin Routes (`routes/adminRoutes.js`)

- `POST /api/admin/products`
  - requires auth + admin
  - creates a new product
- `PUT /api/admin/products/:id`
  - requires auth + admin
  - updates a product
- `DELETE /api/admin/products/:id`
  - requires auth + admin
  - deletes a product
- `GET /api/admin/orders`
  - requires auth + admin
  - returns all orders, with `user` populated
- `PUT /api/admin/orders/:id`
  - requires auth + admin
  - updates order status
- `POST /api/admin/offers`
  - requires auth + admin
  - creates a new offer
- `GET /api/admin/offers`
  - requires auth + admin
  - lists all offers
- `PUT /api/admin/offers/:id`
  - requires auth + admin
  - updates an offer
- `DELETE /api/admin/offers/:id`
  - requires auth + admin
  - deletes an offer

## 9. Controllers

### Auth Controller (`controllers/authController.js`)

#### `register`

- creates a user from `req.body`
- sends back the created user object

#### `login`

- finds user by email
- compares password using bcrypt
- if valid, returns:
  - `token`
  - `user`
- if not valid, returns `400` with `Invalid credentials`

### Products Controller (`controllers/productsController.js`)

#### `getProducts`

- fetches all products where `isActive: true`
- returns them as JSON

#### `getProduct`

- fetches one product by `req.params.id`
- returns the result

### Offer Controller (`controllers/offerController.js`)

#### `createOffer`

- creates a new offer
- validates required fields and discount type
- rejects invalid start/end date ranges
- prevents duplicate offer codes

#### `getOffers`

- lists all offers in descending creation order
- admin-only access

#### `getActiveOffers`

- public endpoint
- returns only active offers whose date range is valid and whose usage limit has not been reached

#### `updateOffer`

- updates an offer by ID
- validates discount values and date ranges

#### `deleteOffer`

- deletes an offer by ID
- returns a confirmation message

#### `validateOffer`

- checks if a promo code exists and is active
- verifies date validity and usage limit
- checks minimum order amount
- calculates discount amount and final price
- returns JSON with `valid`, `discountAmount`, and `finalPrice`

### Order Controller (`controllers/orderController.js`)

#### `createOrder`

- creates an order using request body
- automatically sets `user: req.user._id`
- if `offerCode` is provided, it is re-validated server-side
- applies discount to `totalPrice`
- increments the associated offer’s `usedCount`
- stores `offerCode` and `discountAmount` on the order
- returns created order

#### `myOrders`

- gets all orders belonging to logged-in user
- returns them as JSON

### Admin Controller (`controllers/adminController.js`)

#### `createProduct`

- creates a product

#### `updateProduct`

- updates a product by ID
- returns updated document

#### `deleteProduct`

- deletes a product by ID
- returns `{ message: "Deleted" }`

#### `getOrders`

- fetches all orders
- populates the user field

#### `updateOrderStatus`

- updates an order status by ID
- returns the updated order

## 10. Request Flow Example

### User registration

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Ahmed",
  "email": "ahmed@example.com",
  "password": "123456",
  "role": "user"
}
```

### User login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "ahmed@example.com",
  "password": "123456"
}
```

Response example:

```json
{
  "token": "jwt_token_here",
  "user": {
    "_id": "...",
    "name": "Ahmed",
    "email": "ahmed@example.com",
    "role": "user"
  }
}
```

### Create order with offer

```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "products": [
    { "product": "product_id_here", "quantity": 2 }
  ],
  "totalPrice": 200,
  "offerCode": "SAVE10",
  "address": "Cairo",
  "phone": "01000000000"
}
```

### Validate an offer

```http
POST /api/offers/validate
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "SAVE10",
  "totalPrice": 200
}
```

Response example:

```json
{
  "valid": true,
  "code": "SAVE10",
  "discountAmount": 20,
  "finalPrice": 180
}
```

## 11. API Behavior Summary

This backend follows a straightforward REST structure:

- public routes for auth and product listing
- public offer endpoints for active offers and validation
- protected routes for order operations
- admin-only routes for product, order, and offer management

It is designed for simple e-commerce use cases with basic authentication, role-based access, and promotion logic.

## 12. Security Notes

Current implementation includes basic security features:

- password hashing with bcrypt
- JWT-based authentication
- role-based route protection for admin endpoints

Possible improvements:

- input validation with `express-validator`
- better error handling for duplicate email, bad IDs, and invalid payloads
- pagination on product and order listing
- more detailed order checks before creation
- protection against unauthorized product updates or user impersonation
- environment-based CORS configuration if frontend is added

## 13. App Startup

To run the project locally:

```bash
npm install
npm start
```

This uses `nodemon` to restart the server automatically during development.

## 14. Final Summary

This backend is a lightweight full-stack-ready API for an e-commerce application. It includes:

- MongoDB integration
- Mongoose schemas
- JWT authentication
- user/admin authorization flow
- product management
- order creation and tracking
- promotional offer management
- discount validation and final-price calculation

It is simple, readable, and easy to extend for larger use cases.
