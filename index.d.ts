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
    otpLength?: number;
    otpType?: "numeric" | "alphanumeric";
    otpExpiryMinutes?: number;
    url?: string;
    sendMail?: (params: EmailMessageParams) => Promise<void> | void;
}

export interface ForgotPasswordConfig {
    enabled: boolean;
    otpLength?: number;
    otpType?: "numeric" | "alphanumeric";
    otpExpiryMinutes?: number;
    url?: string;
    sendMail?: (params: EmailMessageParams) => Promise<void> | void;
}

export interface EmailMessageParams {
    email: string;
    otp: string;
    type: "verify" | "reset" | string;
    url?: string | null;
}

export interface HookContext {
    type: "setup" | "register" | "login" | "logout" | "oauth";
    error: Error;
    req?: any;
}

export interface HooksConfig {
    onRegister?: (user: any) => Promise<void> | void;
    onLogin?: (user: any) => Promise<object | void> | object | void;
    onLogout?: (user: any) => Promise<void> | void;
    onVerify?: (user: any) => Promise<void> | void;
    onError?: (context: HookContext) => Promise<void> | void;
}

export interface HashingConfig {
    /**
     * The hashing algorithm to use for passwords.
     * @default "bcrypt"
     */
    algorithm?: "bcrypt" | "argon2";
}

export interface OAuthProviderConfig {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
    callbackUrl: string;
    scope?: string;
    mapProfile?: (profile: any) => { email: string; displayName: string; avatarUrl: string };
    onSuccess?: (req: any, res: any, context: { user: any; isNewUser: boolean; profile: any; accessToken: string }) => void;
    successRedirect?: string;
    failureRedirect?: string;
}

export interface OAuthConfig {
    providers: {
        [key: string]: OAuthProviderConfig;
    };
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
     * Security configuration.
     */
    security?: {
        /**
         * Whether to automatically enable helmet() middleware.
         * @default true
         */
        helmet?: boolean;
    };
    
    /**
     * Custom User Mongoose model. If not provided, one will be created.
     */
    User?: Model<any> | "default";
    
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

    /**
     * Hashing configuration for passwords.
     */
    hashing?: HashingConfig;

    /**
     * OAuth2 configuration for social logins.
     */
    oauth?: OAuthConfig;

    /**
     * Whether to expose the interactive Swagger UI docs at [route]/docs.
     * @default true (in non-production environments)
     */
    enableDocs?: boolean;
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
