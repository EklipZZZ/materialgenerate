import type { Request } from "express";

export interface UserContext {
  id: string;
  email?: string;
}

export interface AuthedRequest extends Request {
  user: UserContext;
}
