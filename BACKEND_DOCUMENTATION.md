# Backend Documentation

This project is a simplified Node.js + Express + MongoDB backend for a guest-based e-commerce API.

The system has only two user types:

- Guest Customer: no account, no login, no JWT, can browse products, add to cart, and place guest orders
- Admin: login with JWT, manages products, orders, and offers

JWT authentication is used only for admin functionality.

## 1. Stack and Tools

- Node.js
- Express.js
- MongoDB + Mongoose
- JWT (JSON Web Tokens)
- bcryptjs for password hashing
- dotenv for environment handling
- nodemon for local development
- multer for local image uploads

## 2. Project Overview

The backend exposes REST API endpoints for:

- public product browsing
- public offer listing and validation
- guest order placement
- admin login
- admin-only product management
- admin-only order management
- admin-only offer management

There are no customer accounts, no customer login, and no customer dashboard.

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
  - serves the `uploads/` folder publicly under `/uploads`
  - registers public routes for products, offers, and guest orders
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
- kept only for admin authentication
- no customer users are created in this simplified architecture

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
- `type` → `discount` or `bundle` (defaults to `discount`)
- `discountType` → `percentage` or `fixed`
- `discountValue` → numeric value used for the discount
- `collectionName` → display name for a bundle collection
- `requiredQuantity` → number of selected collection products required for one bundle
- `bundlePrice` → price for one bundle
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

- `user` → optional legacy reference to `User` for compatibility; not required for guest orders
- `customerName` → guest customer name
- `products` → array of objects with:
  - `product` → reference to `Product`
  - `quantity`
- `offerCode` → optional applied promo code
- `discountAmount` → total discount saved on the order
- `totalPrice` → final server-calculated total after discount
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

- `POST /api/auth/login`
  - admin-only login
  - verifies email/password
  - returns JWT token and user data

Customer registration has been removed.

### Product Routes (`routes/productRoutes.js`)

- `GET /api/products`
  - public
  - returns active products only
- `GET /api/products/:id`
  - public
  - returns a single product by ID

### Offer Routes (`routes/offerRoutes.js`)

- `GET /api/offers/active`
  - public endpoint
  - returns currently valid offers
- `POST /api/offers/validate`
  - public
  - validates a code against a provided `totalPrice`
  - returns discount amount and final price
  - bundle offers also require a `products` array and calculate the bundle from database product prices

### Order Routes (`routes/orderRoutes.js`)

- `POST /api/orders`
  - public
  - guest order placement
  - server calculates final price using product data from MongoDB
  - validates offerCode server-side before saving the order

`GET /api/orders/my` has been removed because customers do not have accounts.

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

#### `login`

- finds admin by email
- compares password using bcrypt
- if valid, returns:
  - `token`
  - `user`
- if not valid, returns `400` with `Invalid credentials`

Customer registration is no longer part of the backend.

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
- supports bundle offers with `type: "bundle"`, `collectionName`, `applicableProducts`, `requiredQuantity`, and `bundlePrice`
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
- for bundle offers, verifies that the cart contains enough products from the collection and applies the bundle price to each complete bundle
- returns JSON with `valid`, `discountAmount`, and `finalPrice`

### Order Controller (`controllers/orderController.js`)

#### `createOrder`

- receives a guest order from the public API
- requires `customerName`, `phone`, `address`, and `products`
- fetches products from MongoDB by ID
- calculates the subtotal from the real product prices in the database
- validates any provided `offerCode` server-side
- computes the discount and final total on the server
- supports bundle offers by applying the bundle price to any complete group of the required quantity from the selected collection products
- increments the offer’s `usedCount`
- stores `offerCode`, `discountAmount`, and the final `totalPrice`
- creates the order without attaching a user account
- returns the created order

There is no customer `myOrders` endpoint.

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

### Admin login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "123456"
}
```

Response example:

```json
{
  "token": "jwt_token_here",
  "user": {
    "_id": "...",
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Public product list

```http
GET /api/products
```

### Public offer validation

```http
POST /api/offers/validate
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

### Guest checkout order

```http
POST /api/orders
Content-Type: application/json

{
  "customerName": "Ahmed Ali",
  "phone": "01012345678",
  "address": "Cairo, Egypt",
  "paymentMethod": "Cash On Delivery",
  "products": [
    { "product": "product_id_here", "quantity": 2 }
  ],
  "offerCode": "SAVE10"
}
```

The backend calculates the final price from the product database and ignores any client-submitted total.

## 11. API Behavior Summary

This backend follows a simplified guest-commerce architecture:

- public product browsing
- public offer listing and validation
- public guest order placement
- admin-only auth, product, order, and offer management

There is no customer registration, no customer login, no JWT for customers, and no customer dashboard.

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

This backend is a simplified guest-order e-commerce API. It includes:

- MongoDB integration
- Mongoose schemas
- public product browsing
- public offer validation
- guest order creation without customer accounts
- admin JWT authentication for management tasks
- product management
- order and offer management by admin
- server-side total calculation for secure pricing

It is intentionally minimal and keeps the architecture simple.
