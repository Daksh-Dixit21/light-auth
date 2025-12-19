import { Application, RequestHandler } from 'express';
import { Model, Mongoose } from 'mongoose';
import { SessionOptions } from 'express-session';
import { Options as RateLimitOptions } from 'express-rate-limit';

export interface PasswordPolicy {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
}

export interface RateLimitingConfig {
    login?: Partial<RateLimitOptions>;
    register?: Partial<RateLimitOptions>;
}

export interface SessionConfig extends Partial<SessionOptions> {
    cookie?: SessionOptions['cookie'];
}

export interface JwtConfig {
    expiresIn?: string | number;
}

export interface EmailVerificationConfig {
    enabled: boolean;
    requiredToLogin?: boolean;
    sendMail?: (to: string, subject: string, html: string) => Promise<void> | void;
}

export interface ForgotPasswordConfig {
    enabled: boolean;
    sendMail?: (to: string, subject: string, html: string) => Promise<void> | void;
}

export interface HookContext {
    type: "setup" | "register" | "login" | "logout";
    error: Error;
    req?: any;
}

export interface HooksConfig {
    onRegister?: (user: any) => Promise<void> | void;
    onLogin?: (user: any) => Promise<object | void> | object | void;
    onLogout?: (user: any) => Promise<void> | void;
    onError?: (context: HookContext) => Promise<void> | void;
}

export interface AuthConfig {
    /**
     * The mongoose instance or object with a model() function.
     * Required.
     */
    db: Mongoose | { model: Function };
    
    /**
     * JWT Secret key. Must be at least 16 characters.
     * Required.
     */
    jwtSecret: string;
    
    /**
     * Base route for auth endpoints.
     * @default "/auth"
     */
    route?: string;
    
    /**
     * Whether to use session-based authentication instead of JWT.
     * @default false
     */
    useSession?: boolean;
    
    /**
     * Allowed roles for users.
     * @default ["user"]
     */
    roles?: string[];
    
    /**
     * Password complexity requirements.
     */
    passwordPolicy?: PasswordPolicy;
    
    /**
     * Rate limiting configuration for login and register routes.
     */
    rateLimiting?: RateLimitingConfig;
    
    /**
     * Session configuration (if useSession is true).
     */
    sessionConfig?: SessionConfig;
    
    /**
     * JWT configuration (if useSession is false).
     */
    jwtConfig?: JwtConfig;
    
    /**
     * Custom User Mongoose model. If not provided, one will be created.
     */
    User?: Model<any>;
    
    /**
     * Email verification settings.
     */
    emailVerification?: EmailVerificationConfig;
    
    /**
     * Forgot password settings.
     */
    forgotPassword?: ForgotPasswordConfig;
    
    /**
     * Lifecycle hooks.
     */
    hooks?: HooksConfig;
}

export interface AuthMiddleware {
    /**
     * Middleware to authenticate requests.
     * Attaches `req.user` if successful.
     */
    authenticate: RequestHandler;
    
    /**
     * Middleware to authorize requests based on roles.
     * @param allowedRoles List of roles allowed to access the route.
     */
    authorize: (allowedRoles: string[]) => RequestHandler;
}

export interface AuthResult {
    auth: AuthMiddleware;
    models: {
        User: Model<any>;
    };
}

/**
 * Sets up authentication, session, and email verification routes for the app.
 * Deep-merges config, validates requirements, and wires up all middleware.
 * @param app - Express app instance.
 * @param config - Auth configuration object.
 * @returns Auth middleware and models.
 */
export function setupAuth(app: Application, config: AuthConfig): Promise<AuthResult>;