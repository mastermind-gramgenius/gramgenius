"use client";

export default function DeleteAccountButton() {
  const handleDelete = async () => {
    if (!confirm("Are you sure? This cannot be undone.")) return;

    const res = await fetch("/api/user/delete", { method: "POST" });
    const json = await res.json();

    if (json.success) {
      alert("Your account has been deleted.");
      window.location.href = "/api/auth/signout";
    } else {
      alert("An error occurred deleting your account.");
    }
  };

  return (
    <button
      className="bg-red-600 text-white px-4 py-2 rounded"
      onClick={handleDelete}
    >
      Delete My Account
    </button>
  );
}
