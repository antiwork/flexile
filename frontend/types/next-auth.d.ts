import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    email?: string;
    name?: string;
    legalName?: string;
    preferredName?: string;
    jwt?: string;
    actorToken?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      legalName?: string;
      preferredName?: string;
      jwt: string;
      primaryToken?: string;
      actorToken?: string | null;
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
