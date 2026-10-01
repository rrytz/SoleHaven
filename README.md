# SoleStyle Studio

# Build a Modern Responsive Shoe E-Commerce Website

Create a **professional, production-ready shoe e-commerce website** designed for both **desktop/PC and mobile users**.

The website should feel like a real modern footwear brand/store — **clean, premium, fast, visually consistent, and easy to shop**, not like a generic AI-generated template.

## 1. Overall Design Direction

Create a modern footwear aesthetic inspired by premium sneaker and fashion e-commerce websites.

### Design principles

* Clean and minimal
* Premium but approachable
* Strong product photography
* Excellent typography hierarchy
* Generous spacing
* Smooth but subtle animations
* Clear calls-to-action
* Mobile-first responsive behavior
* No excessive glassmorphism
* No unnecessary gradients
* No random decorative elements
* No "AI slop" appearance
* Avoid oversized rounded cards everywhere
* Keep the interface visually consistent

Use a neutral foundation such as:

* White / off-white background
* Black / charcoal text
* Subtle gray borders
* One strong accent color for buttons and important actions

The design must work equally well on:

* Desktop
* Laptop
* Tablet
* Mobile phones

---

# 2. Website Structure

Create the following pages:

### Public pages

1. Home
2. Shop / Products
3. Product Details
4. Categories
5. Search Results
6. Shopping Cart
7. Checkout
8. Order Confirmation
9. Login
10. Register
11. Forgot Password
12. Customer Account
13. Order History
14. Wishlist
15. About
16. Contact
17. FAQ
18. Shipping & Returns
19. Privacy Policy
20. Terms & Conditions

### Admin pages

Create an admin dashboard for managing the store:

1. Dashboard
2. Products
3. Add Product
4. Edit Product
5. Categories
6. Orders
7. Customers
8. Inventory
9. Discounts / Coupons
10. Sales Reports
11. Store Settings

---

# 3. Navigation

Create a professional responsive navigation system.

### Desktop navigation

Left:

* Store logo

Center:

* Home
* Shop
* Men
* Women
* Kids
* New Arrivals
* Sale

Right:

* Search
* Wishlist
* Account
* Cart

The cart should display the number of items.

### Mobile navigation

Use a compact header:

Left:

* Hamburger menu

Center:

* Logo

Right:

* Search
* Cart

Create a proper mobile drawer containing:

* Home
* Shop
* Men
* Women
* Kids
* New Arrivals
* Sale
* Wishlist
* Account
* Contact

The navigation must be easy to use with one hand.

---

# 4. Homepage

Build a visually strong e-commerce homepage.

## Hero section

Large footwear-focused hero section.

Example:

**Step Into Something Better**

"Premium footwear designed for everyday movement."

Buttons:

**Shop Men**

**Shop Women**

Use a large high-quality shoe image.

The hero must be responsive and crop properly on mobile without destroying the composition.

---

## Featured Categories

Display category cards:

* Sneakers
* Running
* Basketball
* Casual
* Formal
* Sandals

Each card should contain:

* Product/category image
* Category name
* Shop button/link

---

## New Arrivals

Display a responsive product grid.

Desktop:
4 products per row

Tablet:
3 products per row

Mobile:
2 products per row

Each product card should contain:

* Product image
* Wishlist button
* Brand
* Product name
* Rating
* Price
* Discount price when applicable
* Sale badge
* Available colors

Hover interaction on desktop:

* Slight image transition
* Secondary product image
* Quick View button

Do not make animations excessive.

---

# 5. Product Cards

Create a reusable ProductCard component.

Example:

[Product Image]

Nike
Air Max 270

★★★★★ (124)

₱5,995

~~₱6,995~~

20% OFF

Wishlist icon

The entire card should be clickable.

Add:

* Quick View
* Add to Cart
* Wishlist
* Product comparison if appropriate

On mobile, avoid hover-dependent functionality.

---

# 6. Shop Page

Create a professional product browsing experience.

Desktop layout:

LEFT SIDEBAR

* Category
* Brand
* Size
* Color
* Gender
* Price
* Rating
* Availability
* Sale

RIGHT SIDE

Top toolbar:

"124 Products"

Sort:

* Recommended
* Newest
* Price: Low to High
* Price: High to Low
* Highest Rated

Product grid.

Desktop:
4 columns

Tablet:
3 columns

Mobile:
2 columns

---

# 7. Mobile Filters

On mobile, do NOT permanently display the sidebar.

Instead provide:

**Filter**

**Sort**

buttons at the top.

Clicking Filter opens a full-screen or bottom-sheet filter interface.

Filters should be easy to reset.

Include:

Apply Filters

Clear All

---

# 8. Product Details Page

Create a premium product detail layout.

Desktop:

LEFT:
Large product gallery

RIGHT:
Product information

Mobile:
Image gallery first, information below.

Product information:

Brand

Product Name

★★★★★
124 Reviews

₱5,995

~~₱6,995~~

20% OFF

Description

Color

Available color options

Size

Size selector:

US 6
US 7
US 8
US 9
US 10
US 11
US 12

Add:

"Size Guide"

Quantity selector

Primary button:

**Add to Cart**

Secondary button:

**Buy Now**

Wishlist button

---

# 9. Product Gallery

Allow:

* Multiple product images
* Thumbnail navigation
* Image zoom
* Fullscreen image viewer

Mobile should support swipe gestures.

Use consistent product image ratios.

---

# 10. Product Information Sections

Below the product:

### Description

Detailed product description.

### Specifications

* Brand
* Model
* Material
* Sole
* Gender
* Release Year

### Size Guide

Display a clean size conversion table.

### Shipping

Estimated delivery information.

### Returns

Return policy.

### Reviews

Display:

★★★★★

4.8 / 5

124 reviews

Allow users to filter reviews by rating.

---

# 11. Shopping Cart

Create a professional cart page.

Each item:

Product image

Product name

Size

Color

Price

Quantity selector

Remove

Wishlist

Subtotal

Shipping

Discount

Total

Example:

Subtotal: ₱5,995
Shipping: ₱150
Discount: -₱500

**Total: ₱5,645**

Button:

**Proceed to Checkout**

Also display:

"Free shipping on orders over ₱3,000"

---

# 12. Checkout

Create a simple multi-step checkout.

### Step 1 — Customer Information

* Full Name
* Email
* Phone

### Step 2 — Shipping Address

* Province
* City
* Barangay
* Street Address
* Postal Code

### Step 3 — Delivery

Options:

Standard Delivery

Express Delivery

### Step 4 — Payment

Support a payment architecture that can accommodate:

* Cash on Delivery
* GCash
* Maya
* Credit/Debit Card
* Bank Transfer

Do not hardcode fake payment processing.

Create a clean abstraction so real payment providers can be integrated later.

### Step 5 — Order Review

Display:

Products
Shipping
Discount
Payment method
Total

Button:

**Place Order**

---

# 13. Customer Account

Create a customer dashboard.

Sidebar:

* Overview
* My Orders
* Wishlist
* Addresses
* Account Information
* Change Password
* Logout

Dashboard should show:

Recent Orders

Wishlist Items

Saved Addresses

Account Information

---

# 14. Order Tracking

Each order should have a status timeline:

Order Placed
↓
Payment Confirmed
↓
Processing
↓
Packed
↓
Shipped
↓
Out for Delivery
↓
Delivered

Display:

Order number

Date

Items

Total

Shipping address

Payment method

Current status

---

# 15. Wishlist

Allow customers to save products.

Wishlist page:

Product image
Product name
Price
Availability
Add to Cart
Remove

If a product is unavailable:

"Currently unavailable"

---

# 16. Search

Implement a proper search experience.

Search should support:

* Product name
* Brand
* Category
* SKU

Desktop:
Search dropdown with suggestions.

Mobile:
Dedicated search interface.

Display:

Recent Searches

Popular Searches

Search Results

"No products found" state with useful suggestions.

---

# 17. Admin Dashboard

Create a professional admin interface.

Dashboard cards:

Total Sales

Orders

Customers

Products

Low Stock

Revenue

Include charts:

Sales over time

Orders over time

Top-selling products

Revenue by category

Use realistic demo data if backend data is not yet connected.

---

# 18. Product Management

Admin should be able to:

Create product

Edit product

Delete product

Archive product

Manage stock

Manage sizes

Manage colors

Upload multiple images

Set price

Set discount

Set SKU

Set category

Set brand

Set description

Set specifications

Set featured status

Set new-arrival status

Set sale status

---

# 19. Inventory

Inventory management should support:

Product

SKU

Size

Color

Stock quantity

Low-stock threshold

Stock status

Example:

Air Max 270
Size 9
Black
Stock: 4

Status:

Low Stock

---

# 20. Database Architecture

Design the backend around proper relational entities.

Suggested tables:

users

products

product_images

categories

brands

product_variants

product_sizes

product_colors

inventory

carts

cart_items

wishlists

wishlist_items

orders

order_items

payments

shipping_addresses

reviews

coupons

coupon_usage

admin_users

Create proper foreign keys and indexes.

Do not duplicate data unnecessarily.

Use server-side validation.

Never trust client-side prices or totals.

---

# 21. Security

Implement:

* Authentication
* Authorization
* Password hashing
* Session security
* CSRF protection where applicable
* Input validation
* Output escaping
* SQL injection protection
* Rate limiting for sensitive endpoints
* Secure file upload validation
* Admin route protection

Customers must never be able to access admin functionality.

Never expose secret API keys in frontend code.

---

# 22. Responsive Design Requirements

The website must be genuinely responsive, not simply scaled down.

### Desktop

Minimum target:
1440px

### Laptop

1024px–1439px

### Tablet

768px–1023px

### Mobile

320px–767px

Check:

* Navigation
* Product grids
* Product gallery
* Filters
* Cart
* Checkout
* Forms
* Tables
* Admin dashboard

at every breakpoint.

No horizontal scrolling should occur.

---

# 23. UX Requirements

Add useful states:

Loading

Empty

Error

Success

Out of Stock

Low Stock

Product Not Found

Cart Empty

Wishlist Empty

No Search Results

Order Success

Use skeleton loaders where appropriate.

Use toast notifications for:

Added to cart

Removed from cart

Added to wishlist

Product updated

Order placed

Avoid intrusive popups.

---

# 24. Accessibility

Implement:

* Semantic HTML
* Keyboard navigation
* Visible focus states
* Accessible buttons
* ARIA labels where needed
* Proper form labels
* Good color contrast
* Alt text for product images
* Accessible modal/drawer behavior

Do not rely on color alone to communicate state.

---

# 25. Performance

Optimize the website for fast loading.

Implement:

* Lazy-loaded product images
* Responsive images
* Image compression
* Code splitting where appropriate
* Efficient database queries
* Pagination
* Caching where appropriate
* Avoid unnecessary client-side rendering

The storefront should feel fast even on mobile connections.

---

# 26. Animations

Use subtle animations only.

Examples:

* Product image hover
* Add-to-cart feedback
* Drawer transitions
* Modal transitions
* Page transitions
* Button feedback

Animations should generally be around 150–300ms.

Do not use excessive floating elements, parallax, spinning objects, or decorative animations.

---

# 27. Visual Identity

Create a fictional footwear brand identity.

Use a simple professional wordmark.

Example brand:

**SOLEHAVEN**

Tagline:

**Move With Confidence.**

Do not use real brand logos or copyrighted product imagery.

Use realistic placeholder footwear photography.

---

# 28. Important E-Commerce Rules

Implement real e-commerce logic.

Cart totals must be calculated server-side.

Prices must come from trusted database records.

Inventory must be checked before creating an order.

Prevent purchasing unavailable products.

Prevent negative quantities.

Prevent invalid coupon usage.

Prevent users from modifying another user's orders.

Order totals should be immutable after order creation unless handled through an explicit order adjustment process.

---

# 29. Code Architecture

Keep the application modular.

Create reusable components such as:

Navbar

Footer

ProductCard

ProductGrid

ProductGallery

FilterSidebar

MobileFilter

SearchBar

CartItem

PriceDisplay

RatingStars

Modal

Drawer

Toast

Pagination

Button

Input

Select

Badge

OrderStatus

Do not duplicate components unnecessarily.

Use clear naming conventions.

Keep business logic separate from UI components.

---

# 30. Seed Data

Create realistic demo data.

At least:

30 products

8 categories

5 brands

Multiple sizes

Multiple colors

Sample reviews

Sample customers

Sample orders

Sample inventory

Use Philippine peso pricing.

Example:

₱2,499

₱3,999

₱5,995

₱7,499

---

# 31. Final Quality Standard

The finished website should feel like a **real commercial shoe store**, not a school project or generic dashboard.

Prioritize:

1. Product discovery
2. Shopping experience
3. Mobile usability
4. Visual consistency
5. Performance
6. Accessibility
7. Security
8. Maintainability

Before considering the implementation complete, test the complete flow:

Home
→ Shop
→ Product
→ Select Size
→ Add to Cart
→ Cart
→ Checkout
→ Place Order
→ Order Confirmation
→ Customer Account
→ Order History

Also test:

Mobile navigation

Search

Filters

Wishlist

Inventory

Admin product management

Admin order management

Authentication

Error states

Empty states

Do not leave broken buttons, placeholder links, fake interactions, or unfinished pages.

Build the application as a cohesive system rather than implementing isolated screens.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c831a1b6-6487-4589-8489-34fadab9438f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
