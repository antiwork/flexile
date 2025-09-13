import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    email?: string;
    name?: string;
    legalName?: string;
    preferredName?: string;
    primaryToken?: string;
    actorToken?: string;
  }

  interface Session {
    user: {
      email?: string;
      name?: string;
      legalName?: string;
      preferredName?: string;
      primaryToken?: string;
      actorToken?: string | null;
      jwt: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    primaryToken?: string;
    actorToken?: string | null;
    legalName?: string;
    preferredName?: string;
  }
}
