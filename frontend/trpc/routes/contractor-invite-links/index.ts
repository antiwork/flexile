import { TRPCError } from "@trpc/server";
import { companyProcedure, createRouter } from "@/trpc";

export const contractorInviteLinksRouter = createRouter({
  get: companyProcedure.query(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // TODO: Replace with actual database call
    // For now, return mock data that matches the expected structure
    const mockInviteLink = {
      id: "mock-invite-link-1",
      uuid: "a8TlLsMXST",
      url: "https://flexile.com/join/a8TlLsMXST",
      createdAt: new Date(),
      userId: ctx.companyAdministrator.userId,
      companyId: ctx.company.id,
    };

    return mockInviteLink;
  }),

  reset: companyProcedure.mutation(({ ctx }) => {
    if (!ctx.companyAdministrator) throw new TRPCError({ code: "FORBIDDEN" });

    // TODO: Replace with actual database call to create new UUID
    // For now, return mock data with a new UUID
    const newUuid = Math.random().toString(36).substring(2, 16);
    const newInviteLink = {
      id: "mock-invite-link-1",
      uuid: newUuid,
      url: `https://flexile.com/join/${newUuid}`,
      createdAt: new Date(),
      userId: ctx.companyAdministrator.userId,
      companyId: ctx.company.id,
    };

    return newInviteLink;
  }),
});
