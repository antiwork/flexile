import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    legalName?: string;
    preferredName?: string;
    jwt: string;
    githubUid?: string;
    githubUsername?: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      legalName?: string;
      preferredName?: string;
      githubUid?: string;
      githubUsername?: string;
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
