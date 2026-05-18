# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-05-17

### Added
- **Argon2 Hashing**: Optional, highly secure password hashing using `argon2`. Defaults to `bcrypt` for backward compatibility.
- **OAuth2 Support**: Built-in, generic OAuth2 flow support (e.g. Google, GitHub) using native `fetch`.
- **Swagger Documentation**: Interactive FastAPI-style Swagger UI docs at `/auth/docs` powered by `swagger-ui-express`.
- **Initialization CLI**: Beautiful interactive setup CLI via `npx @daksh-dev/light-auth init`.

### Security
- **NoSQL Injection Patch**: Enforced `typeof string` checks on all incoming user inputs for `email` and `password` to prevent MongoDB operator injection.

## [1.0.3] - 2026-03-08

### Added
- Professional `.prettierrc` for consistent code formatting.
- `SECURITY.md` policy for vulnerability reporting.
- Support for extra fields in `/register` route (filtered for security).
- `security.helmet` option in `AuthConfig` to make `helmet()` middleware optional.
- Production warning when using `MemoryStore` for sessions.

### Fixed
- Improved `setupAuth` startup logs with more detail.
- Enhanced type definitions for `AuthConfig`.

## [1.0.2] - Previous Release

### Added
- Core JWT and Session authentication support.
- Email verification and OTP support.
- Password reset functionality.
- Role-based access control (RBAC).
- Life-cycle hooks for integration.
