import "./globals.css";
import Image from "next/image";
import Providers from "@/components/Providers"; // 👈 add this
import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import LogoutButton from "@/components/LogoutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";

export const metadata = {
  title: "YouPost – Submit Your Ideas",
  description: "Turn your ideas into viral posts.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">

        {/* HEADER */}
        <header className="w-full p-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/10">
          
          <div className="flex items-center gap-3">
            <Image
              src="/youpost-logo.png"
              alt="YouPost Logo"
              width={40}
              height={40}
              className="rounded-md"
            />
            <h1 className="text-2xl font-bold tracking-tight">YouPost</h1>
          </div>

          <div>
            {session ? (
              <div className="flex items-center gap-3">
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full border border-white/20"
                  />
                )}
                <LogoutButton />
              </div>
            ) : (
              <a
                href="/api/auth/signin"
                className="px-4 py-2 rounded-md bg-purple-500 hover:bg-purple-600 text-white font-medium transition"
              >
                Login
              </a>
            )}
          </div>
        </header>

        {/* WRAP ENTIRE APP IN SESSION PROVIDER */}
        <Providers>
          <main className="px-4 py-6">{children}</main>
        </Providers>
             <footer className="mt-20 py-8 border-t border-neutral-200 text-center text-sm text-neutral-500">
          <div className="flex flex-col items-center gap-3">

            <a
              href="/privacy-policy"
              className="hover:text-neutral-800 transition"
            >
              Privacy Policy
            </a>

            <a
              href="/delete-account"
              className="hover:text-neutral-800 transition"
            >
              Delete My Account / Data Deletion
            </a>

            <p className="text-xs mt-4">© {new Date().getFullYear()} YouPost</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
