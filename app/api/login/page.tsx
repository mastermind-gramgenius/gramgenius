"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export default function LoginPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#FF6B6B] via-[#FF00E4] to-[#4A00E0] text-white px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center space-y-8"
      >
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <Image
            src="/youpost-logo.png" // place the logo you exported here
            alt="YouPost Logo"
            width={80}
            height={80}
            className="drop-shadow-xl"
          />
          <h1 className="text-5xl font-bold">YouPost</h1>
        </div>

        <p className="text-lg max-w-lg text-white/90">
          Turn your creative ideas into viral posts.
        </p>

        {/* Facebook Login button */}
        <button
          onClick={() => signIn("facebook")}
          className="bg-white text-[#4267B2] font-semibold py-3 px-8 rounded-full shadow-lg hover:shadow-2xl hover:bg-[#f7f7f7] transition-all duration-200"
        >
          Continue with Facebook
        </button>
        <button
          onClick={() => signIn("resend")}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg"
        >
          Continue with Email
        </button>
      </motion.div>
    </main>
  );
}
