import NextAuth from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface User {
    jwt?: string
  }

  interface Session {
    jwt?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    jwt?: string
  }
}