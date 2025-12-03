"use client";

import { useState } from "react";

export default function DeleteAccountPage() {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return;

    setLoading(true);

    const res = await fetch("/api/user/delete", { method: "POST" });
    const json = await res.json();

    setLoading(false);

    if (json.success) {
      alert("Your account and all your data have been deleted.");
      window.location.href = "/api/auth/signout";
    } else {
      alert("Error deleting your account.");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Delete My Account</h1>
      <p className="text-neutral-600 mb-6">
        Deleting your account will remove all your personal data, submissions,
        and stored information from our system permanently.
      </p>

      <button
        onClick={handleDelete}
        disabled={loading}
        className="bg-red-600 text-white px-5 py-2 rounded"
      >
        {loading ? "Deleting..." : "Delete My Account"}
      </button>
    </main>
  );
}
