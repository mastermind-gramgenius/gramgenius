"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface FormData {
  idea: string;
  instagram: string;
  userMedia?: File | null;
}

export default function IdeaSubmissionForm() {
  const { data: session } = useSession();
  const [mode, setMode] = useState<"idea" | "upload">("idea");
  const [submitted, setSubmitted] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<null | {
    title: string;
    message: string;
    nextAllowed?: string;
  }>(null);

  const [formData, setFormData] = useState<FormData>({
    idea: "",
    instagram: "",
    userMedia: null,
  });

  if (!session) {
    return (
      <div className="text-center py-12">
        <Image
          src="/youpost-logo.png"
          alt="YouPost Logo"
          width={90}
          height={90}
          className="mx-auto mb-4"
        />
        <h2 className="text-xl font-semibold mb-4">You must log in to submit</h2>
        <a
          href="/api/auth/signin"
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 text-white font-semibold shadow-lg"
        >
          Login to continue
        </a>
      </div>
    );
  }

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData({ ...formData, userMedia: file });

    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const body = new FormData();
    body.append("instagram", formData.instagram);

    if (mode === "idea") {
      body.append("idea", formData.idea);
    }

    if (mode === "upload" && formData.userMedia) {
      body.append("userMedia", formData.userMedia);
    }

    const res = await fetch("/api/submit", {
      method: "POST",
      body,
    });

    if (res.ok) {
      setSubmitted(true);
      setFormData({ idea: "", instagram: "", userMedia: null });
      setPreview(null);
      setTimeout(() => setSubmitted(false), 4000);
    } else {
      const data = await res.json();

      if (data.error === "limit_reached") {
        setError({
          title: "Daily Limit Reached",
          message: "You can submit again tomorrow!",
          nextAllowed: data.nextAllowed,
        });
        return;
      }

      setError({
        title: "Oops!",
        message: data.message || "Something went wrong.",
      });
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 p-[2px] rounded-3xl bg-gradient-to-br from-yellow-400 via-pink-500 to-blue-500 shadow-xl">
      <div className="bg-zinc-900 rounded-3xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/youpost-logo.png"
            alt="YouPost Logo"
            width={90}
            height={90}
            className="rounded-xl"
          />
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            Share Your Creativity
          </h2>
          <p className="text-zinc-400 mt-1">
            Submit an idea or upload your own creation.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-6 rounded-xl overflow-hidden border border-zinc-800">
          <button
            onClick={() => setMode("idea")}
            className={`w-1/2 py-3 font-semibold transition ${
              mode === "idea"
                ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            Idea
          </button>

          <button
            onClick={() => setMode("upload")}
            className={`w-1/2 py-3 font-semibold transition ${
              mode === "upload"
                ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            Upload Image
          </button>
        </div>

        {/* Error Block */}
        {error && (
          <div className="mb-5 bg-red-500/20 text-red-300 border border-red-500/40 rounded-xl p-4">
            <h3 className="font-semibold">{error.title}</h3>
            <p>{error.message}</p>

            {error.nextAllowed && (
              <p className="text-sm mt-1 opacity-80">
                You can submit again at{" "}
                {new Date(error.nextAllowed).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}

            <button
              className="mt-3 px-3 py-1 rounded-lg bg-red-500 text-white"
              onClick={() => setError(null)}
            >
              OK
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Instagram handle */}
          <div>
            <label className="block mb-1 font-medium text-zinc-300">
              Instagram (optional)
            </label>
            <input
              type="text"
              name="instagram"
              placeholder="@yourusername"
              value={formData.instagram}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>

          {/* IDEA MODE */}
          {mode === "idea" && (
            <div>
              <label className="block mb-1 font-medium text-zinc-300">
                Your Idea
              </label>
              <textarea
                name="idea"
                value={formData.idea}
                onChange={handleChange}
                rows={4}
                placeholder="Describe your idea..."
                className="w-full p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700 focus:ring-2 focus:ring-yellow-400 outline-none"
              />
            </div>
          )}

          {/* UPLOAD MODE */}
          {mode === "upload" && (
            <div>
              <label className="block mb-1 font-medium text-zinc-300">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="w-full p-3 rounded-lg bg-zinc-800 text-white border border-zinc-700"
              />

              {preview && (
                <div className="mt-4">
                  <Image
                    src={preview}
                    alt="Preview"
                    width={400}
                    height={400}
                    className="rounded-xl border border-zinc-800 shadow-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl text-white font-semibold text-lg shadow-md bg-gradient-to-r from-yellow-400 via-pink-500 to-blue-500 hover:opacity-90 transition"
          >
            Submit
          </button>

          {submitted && (
            <p className="text-center text-green-400 mt-2">
              Thank you! Your submission has been received 🙌
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
