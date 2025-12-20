# @daksh-dev/light-auth

[![NPM Version](https://img.shields.io/npm/v/@daksh-dev/light-auth.svg)](https://www.npmjs.com/package/@daksh-dev/light-auth)
[![License](https://img.shields.io/npm/l/@daksh-dev/light-auth.svg)](https://github.com/Daksh-Dixit21/light-auth/blob/main/LICENSE)
![Code size](https://img.shields.io/github/languages/code-size/Daksh-Dixit21/light-auth)
[![Languages](https://img.shields.io/github/languages/top/Daksh-Dixit21/light-auth)](https://github.com/Daksh-Dixit21/light-auth)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/dakshdixit)

A lightweight, flexible, and secure authentication package for Express.js applications. It supports both session-based and JWT-based authentication, email verification, password reset, and role-based access control.

## Documentation

For full documentation, guides, and API reference, visit our [website](https://light-auth.netlify.app).

## How to Get Started

1.  **Installation**:

    ```bash
    npm install @daksh-dev/light-auth
    ```

2.  **Basic Usage**:

    In your main application file, import and call the `setupAuth` function.

    ```javascript
    import express from 'express';
    import mongoose from 'mongoose';
    import { setupAuth } from '@daksh-dev/light-auth';

    const app = express();

    // Connect to MongoDB
    mongoose.connect('mongodb://localhost:27017/my-app');

    // Setup authentication
    setupAuth(app, {
      db: mongoose.connection,
      jwtSecret: 'YOUR_SUPER_SECRET_KEY_THAT_IS_LONG_AND_COMPLEX',
      // Add other configurations here
    });

    app.listen(3000, () => {
      console.log('Server is running on port 3000');
    });
    ```

## TypeScript Support

This package comes with built-in TypeScript definitions. You don't need to install any additional `@types` packages for this library.

It exports all necessary interfaces like `AuthConfig`, `AuthMiddleware`, and `User` types, so you can enjoy full autocomplete and type checking in your TypeScript projects.

```typescript
import { setupAuth, AuthConfig } from '@daksh-dev/light-auth';

// Configuration is fully typed!
const config: AuthConfig = {
    // ...
};
```

## Dependencies

This package relies on the following key dependencies:

*   **`express`**: The web framework.
*   **`mongoose`**: For MongoDB object modeling.
*   **`bcryptjs`**: For password hashing.
*   **`jsonwebtoken`**: For generating and verifying JWTs.
*   **`express-session`**: For managing user sessions.
*   **`helmet`**: For securing Express apps with various HTTP headers.
*   **`express-rate-limit`**: For protecting against brute-force attacks.
*   **`express-validator`**: For validating request data.
*   **`dotenv`**: For managing environment variables.
*   **`debug`**: For debugging.

## How It Works

This package provides a complete authentication solution for your Express application. It handles user registration, login, and logout, and can be configured to use either JWTs or sessions for managing user authentication.

### Authentication Modes

*   **JWT (JSON Web Token)**: This is the default, stateless mode. When a user logs in, a signed JWT is returned. The client is expected to send this token in the `Authorization` header for any protected routes.
*   **Session**: If `useSession` is set to `true`, the package will use `express-session` to maintain a user session on the server. This is a stateful approach.

## Basic Routes

These are the core authentication routes, available by default under the `/auth` path.

*   **`POST /register`**: Creates a new user.
    *   **Body**: `{ "email": "user@example.com", "password": "yourpassword", "role": "user" }`
*   **`POST /login`**: Authenticates a user and returns a JWT or starts a session.
    *   **Body**: `{ "email": "user@example.com", "password": "yourpassword" }`
*   **`POST /logout`**: Logs a user out. For JWT, this is a client-side action, but the route is provided for consistency.

## Advanced Routes

These routes provide email verification and password reset functionality.

*   **`POST /send-verification-otp`**: Sends an OTP to the user's email for verification.
*   **`POST /verify-email`**: Verifies a user's email with an OTP.
*   **`POST /send-forgot-otp`**: Sends an OTP to initiate a password reset.
*   **`POST /reset-password`**: Resets the user's password using an OTP and a new password.

## How to Configure Routes

Configuration is passed as an object to the `setupAuth` function.

```javascript
setupAuth(app, {
  // Your configuration here
});
```

### Key Configuration Options

*   `db`: **(Required)** Your Mongoose database connection.
*   `jwtSecret`: **(Required)** A strong, secret key for signing JWTs.
*   `User`: **(Required)** Either your custom Mongoose User model or the string `'default'` to auto-generate one.
*   `route`: Base route for auth endpoints.
*   `useSession`: Set to `true` to enable session-based authentication.
*   `roles`: An array of allowed user roles (e.g., `['user', 'admin']`).
*   `passwordPolicy`: An object to define password strength requirements (e.g., `{ minLength: 8 }`).
*   `emailVerification`: An object to configure email verification.
*   `forgotPassword`: An object to configure the password reset feature.

## Default Configuration Values

| Parameter | Default Value | Required |
| --- | --- | --- |
| `db` | `null` | **Yes** |
| `jwtSecret` | `null` | **Yes** |
| `User` | `null` | **Yes** (or `'default'`) |
| `route` | `"/auth"` | No |
| `useSession` | `false` | No |
| `roles` | `["user"]` | No |
| `passwordPolicy` | `{ minLength: 8 }` | No |
| `rateLimiting.login` | `{ windowMs: 900000, max: 5 }` | No |
| `rateLimiting.register` | `{ windowMs: 3600000, max: 5 }` | No |
| `sessionConfig.resave` | `false` | No |
| `sessionConfig.saveUninitialized` | `false` | No |
| `sessionConfig.cookie.secure` | `false` | No |
| `jwtConfig.expiresIn` | `"1h"` | No |


## User Model Util

The `createUserModel` utility is responsible for providing a Mongoose User model. It follows this logic:

1.  If you provide a `User` model in the `setupAuth` configuration, it will be used.
2.  If a model named "User" is already registered with Mongoose, it will be used.
3.  In a development environment, if no model is found, it will generate a default `User.js` file in a `models` directory in your project root.
4.  In a production environment, if no model is found, it will throw an error.

## Middleware

The package returns an `auth` object containing two middleware functions:

*   **`authenticate`**: This middleware protects routes by requiring a valid JWT or session. It populates `req.user` with the user's data.
*   **`authorize`**: This middleware provides role-based access control. You can use it to restrict access to certain routes to specific roles.

    ```javascript
    import { setupAuth } from '@daksh-dev/light-auth';

    const { auth } = setupAuth(app, config);

    app.get('/admin', auth.authenticate, auth.authorize(['admin']), (req, res) => {
      res.send('Admin content');
    });
    ```

## Customizing Validators

### Password Validation

You can customize the password strength requirements through the `passwordPolicy` object in the configuration.

```javascript
setupAuth(app, {
  // ... other config
  passwordPolicy: {
    minLength: 10,
    requireUppercase: true,
    requireNumbers: true,
  }
});
```

### Email and OTP Validation

The email and OTP routes use `express-validator`. While the validation chains are not directly customizable, they are designed to be robust. If you need more advanced validation, you can create your own routes and use the provided services and utilities.

## Getting More Data on Register or Login

To add more data to the user object during registration or to the payload during login, you can use hooks.

### Adding Custom Fields to the User Model

First, ensure your User model includes the fields you want to add.

### Using the `onRegister` Hook

The `onRegister` hook is called after a user is created. You can use it to save additional data.

```javascript
setupAuth(app, {
  // ... other config
  hooks: {
    onRegister: async (user) => {
      // Add a welcome message to the user's profile
      user.welcomeMessage = 'Thanks for joining!';
      await user.save();
    }
  }
});
```

### Using the `onLogin` Hook

The `onLogin` hook allows you to add data to the JWT or session payload.

```javascript
setupAuth(app, {
  // ... other config
  hooks: {
    onLogin: (user) => {
      // Add the user's plan to the JWT payload
      return { plan: user.subscriptionPlan };
    }
  }
});
```

## JWT vs. Session Mode

### JWT Mode (Default)

*   **Stateless**: The server does not store user session data.
*   **Scalable**: Ideal for microservices and distributed systems.
*   **Client Responsibility**: The client must securely store the JWT and send it with each request.

### Session Mode

*   **Stateful**: The server stores user session data.
*   **Configuration**: Requires `useSession: true` and a configured session store for production environments.
*   **Cookie-Based**: Uses cookies to track user sessions.

## Hooks and Advanced Features

### Hooks

You can provide custom functions (hooks) to extend the default behavior:

*   `onRegister`: Called after a user is successfully registered.
*   `onLogin`: Called after a user logs in. Can be used to add extra data to the user payload.
*   `onLogout`: Called after a user logs out.
*   `onVerify`: Called after an email is successfully verified.
*   `onError`: Called when an error occurs within the package.

Example:

```javascript
setupAuth(app, {
  // ... other config
  hooks: {
    onRegister: (user) => {
      console.log(`New user registered: ${user.email}`);
    }
  }
});
```

### Rate Limiting

To prevent brute-force attacks, rate limiting is enabled by default for the `login` and `register` routes. You can customize the settings in the `rateLimiting` configuration object.
