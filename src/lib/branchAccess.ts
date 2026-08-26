import type { Request } from 'express';

export function isAdmin(req: Request) {
  return req.user?.roles.includes('ADMIN') ?? false;
}

export function userBranchId(req: Request): number | null {
  return req.user?.branchId ?? null;
}

export function branchForWrite(req: Request, requestedBranchId?: number | null): number | null {
  if (isAdmin(req)) return requestedBranchId ?? null;
  return userBranchId(req);
}

export function canAccessBranch(req: Request, branchId: number | null | undefined) {
  if (isAdmin(req)) return true;
  const own = userBranchId(req);
  return branchId != null && own != null && Number(branchId) === Number(own);
}
