"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white font-medium transition"
    >
      Log out
    </button>
  );
}
