import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { usersTable } from "../db/schema/index";

export interface AuthPayload {
  userId: number;
  email: string;
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

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  requireAuth(req, res, async () => {
    try {
      const [user] = await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, req.user!.userId));

      if (!user || user.role !== "admin") {
        res.status(403).json({ error: "Admin access required" });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  });
}

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
