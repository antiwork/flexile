import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (existingUser) {
          await db
            .update(users)
            .set({
              googleId: user.id,
              name: user.name ?? null,
              image: user.image ?? null,
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id));
        } else {
          await db.insert(users).values({
            email: user.email,
            googleId: user.id,
            name: user.name ?? null,
            image: user.image ?? null,
          });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        const user = await db.query.users.findFirst({
          where: eq(users.googleId, token.sub),
        });
        if (user) {
          session.user.id = user.id.toString();
          session.user.email = user.email;
          session.user.name = user.name;
          session.user.image = user.image;
          session.accessToken = token.sub;
        }
      }
      return session;
    },
    jwt({ token, user }) {
      if (user.id) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};

const handler = NextAuth(authOptions) as any;

export { handler as GET, handler as POST };
