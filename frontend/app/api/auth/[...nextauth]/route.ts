import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- next-auth's types are horrible
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
