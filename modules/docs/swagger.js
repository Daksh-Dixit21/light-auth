import swaggerUi from "swagger-ui-express";

/**
 * Generates an OpenAPI specification for the configured light-auth routes.
 * Dynamically includes Email Verification, Forgot Password, and OAuth endpoints based on config.
 * @param {Object} config - The merged light-auth configuration.
 * @returns {Object} OpenAPI JSON document.
 */
function generateOpenAPISpec(config) {
  const base = config.route || "/auth";
  
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Light-Auth API",
      version: "1.0.0",
      description: "Interactive documentation for your light-auth endpoints. Use this to test your authentication flows.",
    },
    servers: [
      { url: "/" } // Relative URL to support any deployment environment
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" }
          }
        },
        UserPayload: {
          type: "object",
          properties: {
            _id: { type: "string" },
            email: { type: "string" },
            role: { type: "string" }
          }
        }
      }
    },
    paths: {
      [`${base}/register`]: {
        post: {
          summary: "Register a new user",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", format: "password" },
                    role: { type: "string", default: "user" },
                    name: { type: "string", description: "Optional extra field" }
                  }
                }
              }
            }
          },
          responses: {
            201: { description: "User registered successfully" },
            400: { description: "Validation error" },
            409: { description: "User already exists" }
          }
        }
      },
      [`${base}/login`]: {
        post: {
          summary: "Log in an existing user",
          tags: ["Authentication"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string", format: "password" }
                  }
                }
              }
            }
          },
          responses: {
            200: { 
              description: "Login successful",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string", description: "JWT Token (if useSession is false)" },
                      message: { type: "string" },
                      user: { $ref: "#/components/schemas/UserPayload" }
                    }
                  }
                }
              }
            },
            401: { description: "Invalid credentials" },
            403: { description: "Email not verified" }
          }
        }
      },
      [`${base}/logout`]: {
        post: {
          summary: "Log out user",
          tags: ["Authentication"],
          responses: {
            200: { description: "Logged out successfully" }
          }
        }
      }
    }
  };

  // Dynamically add Email Verification routes
  if (config.emailVerification?.enabled) {
    spec.paths[`${base}/send-verification-otp`] = {
      post: {
        summary: "Send verification OTP",
        tags: ["Email Verification"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } }
        },
        responses: { 200: { description: "OTP sent" }, 404: { description: "User not found" } }
      }
    };
    spec.paths[`${base}/verify-email`] = {
      post: {
        summary: "Verify email with OTP",
        tags: ["Email Verification"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, otp: { type: "string" } } } } }
        },
        responses: { 200: { description: "Verified successfully" }, 400: { description: "Invalid OTP" } }
      }
    };
  }

  // Dynamically add Forgot Password routes
  if (config.forgotPassword?.enabled) {
    spec.paths[`${base}/send-forgot-otp`] = {
      post: {
        summary: "Send password reset OTP",
        tags: ["Password Reset"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } }
        },
        responses: { 200: { description: "OTP sent" }, 404: { description: "User not found" } }
      }
    };
    spec.paths[`${base}/reset-password`] = {
      post: {
        summary: "Reset password with OTP",
        tags: ["Password Reset"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, otp: { type: "string" }, newPassword: { type: "string" } } } } }
        },
        responses: { 200: { description: "Password reset successful" }, 400: { description: "Invalid OTP or weak password" } }
      }
    };
  }

  // Dynamically add OAuth routes
  const providers = config.oauth?.providers || {};
  if (Object.keys(providers).length > 0) {
    for (const name of Object.keys(providers)) {
      spec.paths[`${base}/oauth/${name}`] = {
        get: {
          summary: `Login with ${name}`,
          tags: ["OAuth2"],
          description: `Redirects the browser to ${name}'s consent screen. Do not call this via AJAX.`,
          responses: { 302: { description: "Redirect to provider" } }
        }
      };
    }
  }

  return spec;
}

/**
 * Mounts the Swagger UI documentation route.
 * @param {import('express').Application} app - Express app instance.
 * @param {Object} config - Auth configuration object.
 */
export function setupSwaggerDocs(app, config) {
  const base = config.route || "/auth";
  const docRoute = `${base}/docs`;
  
  const spec = generateOpenAPISpec(config);
  
  app.use(docRoute, swaggerUi.serve, swaggerUi.setup(spec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: "Light-Auth API Docs",
  }));
}
