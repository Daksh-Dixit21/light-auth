#!/usr/bin/env node

import fs from "fs";
import path from "path";
import * as prompts from "@clack/prompts";
import picocolors from "picocolors";

const { cyan, green, bold } = picocolors;

function cancelSetup(message) {
  prompts.cancel(message);
  process.exit(0);
}

function toImportPath(fromDir, targetPath) {
  const relativePath = path.relative(fromDir, targetPath).replace(/\\/g, "/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function createBackupPath(filePath) {
  const parsed = path.parse(filePath);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(parsed.dir, `${parsed.name}.${stamp}.bak${parsed.ext}`);
}

async function main() {
  console.log("\n");
  prompts.intro(cyan(bold(" Welcome to Light-Auth Setup ")));
  prompts.note(
    "Core setup is required. OAuth providers, email verification, password reset, and Argon2 hashing are optional add-ons you can skip now and configure later.",
    "Optional Features"
  );

  // 1. Interactive questions
  const project = await prompts.group(
    {
      mode: () =>
        prompts.select({
          message: "Which authentication mode do you want to use?",
          initialValue: "jwt",
          options: [
            { value: "jwt", label: "JWT (Stateless, great for React/Next.js SPA)" },
            { value: "session", label: "Sessions (Stateful, great for traditional web apps)" },
          ],
        }),
      hashing: () =>
        prompts.select({
          message: "Which password hashing algorithm do you want to use?",
          initialValue: "bcrypt",
          options: [
            { value: "bcrypt", label: "Bcrypt (Standard, default)" },
            { value: "argon2", label: "Argon2 (More secure, requires installing 'argon2' package)" },
          ],
        }),
      oauth: () =>
        prompts.multiselect({
          message: "Optional: enable OAuth2 providers? (Space to select, Enter to skip)",
          options: [
            { value: "google", label: "Google" },
            { value: "github", label: "GitHub" },
          ],
          required: false,
        }),
      email: () =>
        prompts.confirm({
          message: "Optional: enable Email Verification & Password Reset?",
          initialValue: false,
        }),
      outDir: () =>
        prompts.text({
          message: "Where should we generate the auth file?",
          initialValue: "src/config/auth.js",
          placeholder: "src/config/auth.js",
        }),
      userModelPath: () =>
        prompts.text({
          message: "Where is your User model? Existing files will be reused, not overwritten.",
          initialValue: "models/User.js",
          placeholder: "models/User.js",
        }),
    },
    {
      onCancel: () => {
        cancelSetup("Setup cancelled.");
      },
    }
  );

  // 2. Resolve paths
  const outPath = path.resolve(process.cwd(), project.outDir);
  const outDir = path.dirname(outPath);
  const userModelPath = path.resolve(process.cwd(), project.userModelPath);
  const userModelExists = fs.existsSync(userModelPath);
  const authFileExists = fs.existsSync(outPath);
  let authBackupPath = null;

  if (authFileExists) {
    const action = await prompts.select({
      message: `${project.outDir} already exists. How should Light-Auth handle it?`,
      initialValue: "backup",
      options: [
        { value: "backup", label: "Create a backup, then overwrite" },
        { value: "overwrite", label: "Overwrite without backup" },
        { value: "cancel", label: "Cancel setup" },
      ],
    });

    if (prompts.isCancel(action) || action === "cancel") {
      cancelSetup("Setup cancelled. Existing auth file was left untouched.");
    }

    if (action === "backup") {
      authBackupPath = createBackupPath(outPath);
      fs.copyFileSync(outPath, authBackupPath);
    }
  }

  if (userModelExists) {
    prompts.note(
      `Found ${path.relative(process.cwd(), userModelPath)}. Light-Auth will import this model and will not modify it.\n\nMake sure it has email, password, role, and any OTP fields required by the features you enable.`,
      "Existing User Model"
    );
  }

  const spinner = prompts.spinner();
  spinner.start("Generating code...");

  // Ensure directories exist
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(path.dirname(userModelPath))) fs.mkdirSync(path.dirname(userModelPath), { recursive: true });

  // 3. Generate User Model
  const userSchemaFields = [
    `  email: { type: String, required: true, unique: true },`,
    `  password: { type: String, required: true, select: false },`,
    `  role: { type: String, enum: ['user', 'admin'], default: 'user' },`,
    `  name: String,`
  ];

  if (project.email) {
    userSchemaFields.push(
      `  emailOtp: String,`,
      `  emailOtpExpires: Date,`,
      `  resetOtp: String,`,
      `  resetOtpExpires: Date,`,
      `  verified: { type: Boolean, default: false },`
    );
  } else {
    userSchemaFields.push(`  verified: { type: Boolean, default: true },`);
  }

  const userModelTemplate = `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
${userSchemaFields.join("\n")}
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
`;

  if (!userModelExists) {
    fs.writeFileSync(userModelPath, userModelTemplate);
  }

  // 4. Generate Auth Config File
  let oauthConfigStr = "{}";
  if (project.oauth.length > 0) {
    const providers = project.oauth.map((p) => {
      if (p === "google") {
        return `
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
        callbackUrl: "http://localhost:3000/auth/oauth/google/callback",
      }`;
      }
      if (p === "github") {
        return `
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        callbackUrl: "http://localhost:3000/auth/oauth/github/callback",
        mapProfile: (profile) => ({
          email: profile.email,
          displayName: profile.name || profile.login,
          avatarUrl: profile.avatar_url
        })
      }`;
      }
    });
    oauthConfigStr = `{
    providers: {${providers.join(",")}
    }
  }`;
  }

  const emailConfigStr = project.email
    ? `
  emailVerification: { enabled: true },
  forgotPassword: { enabled: true },`
    : `
  emailVerification: { enabled: false },
  forgotPassword: { enabled: false },`;

  const authFileTemplate = `import express from 'express';
import mongoose from 'mongoose';
import { setupAuth } from '@daksh-dev/light-auth';
import User from '${toImportPath(outDir, userModelPath)}';

const router = express.Router();

export async function initAuth() {
  const { auth } = await setupAuth(router, {
    db: mongoose.connection,
    jwtSecret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    useSession: ${project.mode === "session"},
    hashing: { algorithm: '${project.hashing}' },
    User,${emailConfigStr}
    oauth: ${oauthConfigStr},
    enableDocs: process.env.NODE_ENV !== 'production'
  });

  return { authRouter: router, auth };
}
`;

  fs.writeFileSync(outPath, authFileTemplate);

  // 5. Generate/Update .env
  const envPath = path.resolve(process.cwd(), ".env");
  const envVars = [
    `JWT_SECRET="generate_a_random_string_here"`,
    `MONGO_URI="mongodb://localhost:27017/my-app"`
  ];

  if (project.oauth.includes("google")) {
    envVars.push(`GOOGLE_CLIENT_ID=""`, `GOOGLE_CLIENT_SECRET=""`);
  }
  if (project.oauth.includes("github")) {
    envVars.push(`GITHUB_CLIENT_ID=""`, `GITHUB_CLIENT_SECRET=""`);
  }

  let existingEnv = "";
  if (fs.existsSync(envPath)) {
    existingEnv = fs.readFileSync(envPath, "utf-8");
  }

  const varsToAdd = envVars.filter((v) => !existingEnv.includes(v.split("=")[0]));
  if (varsToAdd.length > 0) {
    fs.appendFileSync(envPath, (existingEnv.endsWith("\n") || existingEnv === "" ? "" : "\n") + varsToAdd.join("\n") + "\n");
  }

  spinner.stop("Generated successfully!");

  // 6. Post-install instructions
  prompts.note(
    `${authBackupPath ? `Backup created: ${cyan(path.relative(process.cwd(), authBackupPath))}\n\n` : ""}1. ${project.hashing === "argon2" ? `Run ${cyan("npm install argon2")} to use Argon2 hashing.\n2. ` : ""}Open ${cyan(".env")} and fill in your secrets.
${project.hashing === "argon2" ? "3" : "2"}. Add the following to your main app file (e.g. app.js):

${green(`import { initAuth } from '${toImportPath(process.cwd(), outPath)}';

// Wait for mongoose connection, then:
const { authRouter } = await initAuth();
app.use(authRouter);`)}`,
    "Next Steps"
  );

  prompts.outro(green("You're all set!"));
}

main().catch(console.error);
