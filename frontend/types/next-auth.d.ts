import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    legalName?: string;
    preferredName?: string;
    jwt: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      legalName?: string;
      preferredName?: string;
      jwt: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    jwt?: string;
    legalName?: string;
    preferredName?: string;
  }
}
