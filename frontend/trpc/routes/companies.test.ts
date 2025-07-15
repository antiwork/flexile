import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import { companiesRouter } from "./companies";
import type { CompanyContext } from "@/trpc";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      companyAdministrators: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

// Helper to create mock context
const createMockContext = (overrides?: Partial<CompanyContext>): CompanyContext => ({
  userId: 1,
  company: { id: BigInt(1), externalId: "test-company", name: "Test Company" } as any,
  user: { id: BigInt(1), email: "admin@test.com" } as any,
  companyAdministrator: { id: BigInt(1) } as any,
  companyContractor: null,
  companyInvestor: null,
  companyLawyer: null,
  host: "localhost",
  ipAddress: "127.0.0.1",
  userAgent: "test",
  headers: {},
  ...overrides,
});

describe("companies.toggleAdminRole", () => {
  it("should add a user as admin when they are not currently an admin", async () => {
    const mockAdmins = [
      { userId: BigInt(1), companyId: BigInt(1) },
    ];
    
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: BigInt(2), externalId: "2" } as any);
    vi.mocked(db.query.companyAdministrators.findMany).mockResolvedValue(mockAdmins as any);
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    } as any);

    const ctx = createMockContext();
    const caller = companiesRouter.createCaller(ctx);
    
    await caller.toggleAdminRole({ 
      companyId: "test-company", 
      userId: "2",
      isAdmin: true,
    });
    
    expect(db.insert).toHaveBeenCalled();
  });

  it("should remove a user as admin when they are currently an admin", async () => {
    const mockAdmins = [
      { userId: BigInt(1), companyId: BigInt(1) },
      { userId: BigInt(2), companyId: BigInt(1) },
    ];
    
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: BigInt(2), externalId: "2" } as any);
    vi.mocked(db.query.companyAdministrators.findMany).mockResolvedValue(mockAdmins as any);
    vi.mocked(db.delete).mockReturnValue({
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(undefined),
    } as any);

    const ctx = createMockContext();
    const caller = companiesRouter.createCaller(ctx);
    
    await caller.toggleAdminRole({ 
      companyId: "test-company", 
      userId: "2",
      isAdmin: false,
    });
    
    expect(db.delete).toHaveBeenCalled();
  });

  it("should throw FORBIDDEN error for non-administrators", async () => {
    const ctx = createMockContext({ companyAdministrator: null });
    const caller = companiesRouter.createCaller(ctx);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "2",
        isAdmin: true,
      })
    ).rejects.toThrow(TRPCError);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "2",
        isAdmin: true,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("should throw NOT_FOUND when user does not exist", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(null);
    
    const ctx = createMockContext();
    const caller = companiesRouter.createCaller(ctx);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "non-existent",
        isAdmin: true,
      })
    ).rejects.toThrow(TRPCError);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "non-existent",
        isAdmin: true,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("should throw BAD_REQUEST when trying to remove the last admin", async () => {
    const mockAdmins = [
      { userId: BigInt(1), companyId: BigInt(1) },
    ];
    
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: BigInt(1), externalId: "1" } as any);
    vi.mocked(db.query.companyAdministrators.findMany).mockResolvedValue(mockAdmins as any);

    const ctx = createMockContext();
    const caller = companiesRouter.createCaller(ctx);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "1",
        isAdmin: false,
      })
    ).rejects.toThrow(TRPCError);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "1",
        isAdmin: false,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot remove the last administrator",
    });
  });

  it("should throw BAD_REQUEST when user tries to remove their own admin role", async () => {
    const mockAdmins = [
      { userId: BigInt(1), companyId: BigInt(1) },
      { userId: BigInt(2), companyId: BigInt(1) },
    ];
    
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: BigInt(1), externalId: "1" } as any);
    vi.mocked(db.query.companyAdministrators.findMany).mockResolvedValue(mockAdmins as any);

    const ctx = createMockContext({ userId: 1 });
    const caller = companiesRouter.createCaller(ctx);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "1",
        isAdmin: false,
      })
    ).rejects.toThrow(TRPCError);
    
    await expect(
      caller.toggleAdminRole({ 
        companyId: "test-company", 
        userId: "1",
        isAdmin: false,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You cannot remove your own admin role",
    });
  });
});