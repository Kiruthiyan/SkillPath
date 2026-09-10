import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { usersTable } from "../db/schema/index";
import type { Role } from "../lib/roles";
import { isSessionTokenStale } from "../lib/session-token";

export { isSessionTokenStale };

export interface AuthPayload {
  userId: number;
  email: string;
  /**
   * Token version at issue time. Must match `users.token_version`, which is bumped
   * on every password change, so old tokens are rejected after a password change.
   * Optional so tokens issued before this claim existed still parse; those are
   * treated as version 0, which is the default for existing rows.
   */
  tv?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

export interface PasswordResetPayload {
  userId: number;
  purpose: "password_reset";
}

export function signPasswordResetToken(userId: number): string {
  const payload: PasswordResetPayload = { userId, purpose: "password_reset" };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "10m" });
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const decoded = jwt.verify(token, getJwtSecret()) as PasswordResetPayload;
  if (decoded.purpose !== "password_reset") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
}

export interface InvitePayload {
  email: string;
  role: "university_admin" | "mentor";
  universityId?: number;
  purpose: "invite";
}

export function signInviteToken(payload: Omit<InvitePayload, "purpose">): string {
  const full: InvitePayload = { ...payload, purpose: "invite" };
  return jwt.sign(full, getJwtSecret(), { expiresIn: "3d" });
}

export function verifyInviteToken(token: string): InvitePayload {
  const decoded = jwt.verify(token, getJwtSecret()) as InvitePayload;
  if (decoded.purpose !== "invite") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * requireAuth plus a database check that the account is still active and the
 * token has not been invalidated by a password change. Use it on any route that
 * acts on the account itself; plain requireAuth only proves the JWT is signed.
 */
export function requireActiveSession(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, async () => {
    try {
      const [user] = await db
        .select({ isActive: usersTable.isActive, tokenVersion: usersTable.tokenVersion })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId));

      if (!user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      if (isSessionTokenStale(req.user!, user.tokenVersion)) {
        res.status(401).json({ error: "Session expired. Please sign in again." });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: "This account has been deactivated." });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  });
}

export function requireRole(...roles: Role[]) {
  return function roleGate(req: Request, res: Response, next: NextFunction): void {
    requireAuth(req, res, async () => {
      try {
        const [user] = await db
          .select({
            role: usersTable.role,
            isActive: usersTable.isActive,
            mustChangePassword: usersTable.mustChangePassword,
            tokenVersion: usersTable.tokenVersion,
          })
          .from(usersTable)
          .where(eq(usersTable.id, req.user!.userId));

        if (!user || !user.isActive) {
          res.status(403).json({ error: "Access denied" });
          return;
        }

        if (isSessionTokenStale(req.user!, user.tokenVersion)) {
          res.status(401).json({ error: "Session expired. Please sign in again." });
          return;
        }

        if (!roles.includes(user.role as Role)) {
          res.status(403).json({ error: "Insufficient permissions" });
          return;
        }

        // Change-password itself must remain reachable so the forced flow can complete.
        if (user.mustChangePassword && req.path !== "/change-password") {
          res.status(403).json({ error: "password_change_required" });
          return;
        }

        next();
      } catch (err) {
        next(err);
      }
    });
  };
}

export const requireAdmin = requireRole("admin", "super_admin");
export const requireSuperAdmin = requireRole("super_admin");

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
