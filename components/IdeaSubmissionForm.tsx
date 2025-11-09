"use client";

import { useState, ChangeEvent, FormEvent } from "react";

interface FormData {
  idea: string;
  type: string;   // will be "" in upload mode
  mood: string;   // will be "" in upload mode
  instagram: string;
  email: string;
  userMedia?: string; // Cloudinary URL
}

export default function IdeaSubmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    idea: "",
    type: "Surprise me!",
    mood: "Funny",
    instagram: "",
    email: "",
  });

  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = "gramgenius_uploads"; // <- ensure this unsigned preset exists in Cloudinary

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Big toggle button: switch modes and normalize fields
  const toggleMode = () => {
    setUploadMode((prev) => {
      const next = !prev;
      if (next) {
        // Going to UPLOAD mode: clear text idea & clear type/mood
        setFormData((f) => ({
          ...f,
          idea: "",
          type: "",
          mood: "",
        }));
      } else {
        // Going back to IDEA mode: clear uploaded media, restore defaults for selects
        setFormData((f) => ({
          ...f,
          userMedia: undefined,
          type: "Surprise me!",
          mood: "Funny",
        }));
      }
      return next;
    });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!CLOUD_NAME) {
      alert("Cloud name missing. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local");
      return;
    }

    setUploading(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", UPLOAD_PRESET); // must be an **unsigned** preset

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: data,
      });

      const result = await res.json();
      // Helpful logs if something goes wrong
      if (!res.ok) {
        console.error("Cloudinary error:", result);
        alert(result?.error?.message || "Upload failed. Please try again.");
        return;
      }

      if (result.secure_url) {
        setFormData((prev) => ({ ...prev, userMedia: result.secure_url }));
      } else {
        console.error("Unexpected Cloudinary response:", result);
        alert("Upload failed. Please try again.");
      }
    } catch (err) {
      console.error("Upload exception:", err);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return; // 🧩 Prevent double submission
    setIsSubmitting(true);
    // When in upload mode, enforce empty type/mood on payload
    const payload = uploadMode
      ? { ...formData, type: "", mood: "" }
      : formData;

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitted(true);
        setFormData({
          idea: "",
          type: uploadMode ? "" : "Surprise me!",
          mood: uploadMode ? "" : "Funny",
          instagram: "",
          email: "",
          userMedia: uploadMode ? undefined : undefined,
        });
        setTimeout(() => setSubmitted(false), 4000);
      } else {
        const txt = await res.text();
        console.error("Submit error:", txt);
        alert("Something went wrong. Please try again.");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to connect to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white text-gray-900 p-8 rounded-2xl shadow-2xl max-w-md mx-auto space-y-5"
    >
      {/* Brand */}
      <div className="flex items-center justify-center space-x-3 mb-2">
        <img src="/youpost-logo.png" alt="YouPost logo" className="h-10 w-10 rounded-lg" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-600 bg-clip-text text-transparent">
          YouPost
        </h2>
      </div>

      {/* Big toggle button */}
      <button
        type="button"
        onClick={toggleMode}
        className="w-full py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-pink-500 via-purple-500 to-blue-600 hover:opacity-90 transition-all duration-200"
      >
        {uploadMode ? "💡 Submit an Idea Instead" : "📸 Upload an Image Instead"}
      </button>

      {/* Content area */}
      {!uploadMode ? (
        <>
          <textarea
            name="idea"
            value={formData.idea}
            onChange={handleChange}
            placeholder="Describe your idea..."
            required
            className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:outline-none resize-none"
          />
          <div className="flex space-x-3">
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="flex-1 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
            >
              <option>Surprise me!</option>
              <option>Story</option>
              <option>Meme</option>
              <option>Art / Design</option>
              <option>Photography</option>
              <option>Educational</option>
            </select>
            <select
              name="mood"
              value={formData.mood}
              onChange={handleChange}
              className="flex-1 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
            >
              <option>Funny</option>
              <option>Inspiring</option>
              <option>Emotional</option>
              <option>Chill</option>
              <option>Motivational</option>
            </select>
          </div>
        </>
      ) : (
        <div className="space-y-3 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg p-2 bg-gray-50"
          />
          {uploading && <p className="text-sm text-pink-500">Uploading to Cloudinary...</p>}
          {formData.userMedia && (
            <img
              src={formData.userMedia}
              alt="Uploaded preview"
              className="mt-3 rounded-lg max-h-48 mx-auto shadow-md"
            />
          )}
        </div>
      )}

      <input
        type="text"
        name="instagram"
        value={formData.instagram}
        onChange={handleChange}
        placeholder="@yourhandle"
        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
        required
      />

      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email (optional)"
        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 focus:outline-none"
      />

      <button
        type="submit"
        disabled={uploading || isSubmitting}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-blue-600 text-white font-semibold shadow-md hover:opacity-90 transition-all duration-200"
      >
        {isSubmitting ? "Submitting..." : uploadMode ? "Upload" : "Submit Idea"}
      </button>

      {submitted && (
        <p className="text-green-600 text-center animate-pulse">
          ✅ Thanks! Your submission has been received.
        </p>
      )}
    </form>
  );
}
