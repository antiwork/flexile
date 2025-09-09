import "next-auth";

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
    impersonation?: {
      jwt: string;
      user: {
        id: number;
        email: string;
        name: string;
        legal_name?: string;
        preferred_name?: string;
      };
      originalUser: {
        id: string;
        email: string;
        name: string;
        legalName?: string;
        preferredName?: string;
        jwt: string;
      };
    };
  }
}

// Helper types for API responses
interface ImpersonationApiResponse {
  success?: boolean;
  error?: string;
  impersonation_jwt?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    legal_name?: string;
    preferred_name?: string;
  };
}

interface ImpersonationRequestBody {
  email?: string;
}

// Helper type for session with impersonation
type SessionWithImpersonation = Session & {
  impersonation?: {
    user: {
      email: string;
    };
  };
};

declare module "next-auth/jwt" {
  interface JWT {
    jwt?: string;
    legalName?: string;
    preferredName?: string;
    impersonation?: {
      jwt: string;
      user: {
        id: number;
        email: string;
        name: string;
        legal_name?: string;
        preferred_name?: string;
      };
      originalUser: {
        id: string;
        email: string;
        name: string;
        legalName?: string;
        preferredName?: string;
        jwt: string;
      };
    };
  }
}
