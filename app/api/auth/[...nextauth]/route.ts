import NextAuth from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      from: "no-reply@youpost.app",
      sendVerificationRequest: async ({ identifier, url }) => {
        await resend.emails.send({
          from: "YouPost <no-reply@youpost.app>",
          to: identifier,
          subject: "Sign in to YouPost",
          html: `<p>Click <a href="${url}">here</a> to sign in to your account.</p>`,
        });
      },
    }),
  ],
};

// ✅ register the route
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
