import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    email: string;
    name: string;
    legalName?: string;
    preferredName?: string;
    jwt: string;
    impersonationJwt?: string;
    isImpersonating?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      legalName?: string;
      preferredName?: string;
      jwt: string;
      impersonationJwt?: string;
      isImpersonating?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    jwt?: string;
    legalName?: string;
    preferredName?: string;
    impersonationJwt?: string;
  }
}
