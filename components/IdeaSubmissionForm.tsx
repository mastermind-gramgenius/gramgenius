"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { motion } from "framer-motion";

interface FormData {
  idea: string;
  type: string;
  mood: string;
  instagram: string;
  email: string;
}

export default function IdeaSubmissionForm() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    idea: "",
    type: "Surprise me!",
    mood: "Funny",
    instagram: "",
    email: "",
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-xl mx-auto p-8 bg-gray-900 text-gray-100 rounded-2xl shadow-2xl space-y-6"
    >
      <h2 className="text-3xl font-bold text-center text-white">
        💡 Share Your Idea
      </h2>
      <p className="text-center text-gray-300">
        Submit your creative idea and we’ll turn it into an Instagram post — meme, reel, or artwork.  
        You’ll get credit if it’s published!
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block font-semibold mb-1 text-white">Your Idea *</label>
          <textarea
            name="idea"
            required
            placeholder="Describe your idea..."
            value={formData.idea}
            onChange={handleChange}
            className="w-full p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          ></textarea>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-white">
            Preferred Post Type
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="w-full p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
          >
            <option>Surprise me!</option>
            <option>Reel</option>
            <option>Meme</option>
            <option>Artwork</option>
            <option>Joke/Quote</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-white">Mood / Tone</label>
          <select
            name="mood"
            value={formData.mood}
            onChange={handleChange}
            className="w-full p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
          >
            <option>Funny</option>
            <option>Thought-provoking</option>
            <option>Aesthetic</option>
            <option>Trendy</option>
            <option>Emotional</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-white">
            Your Instagram Handle
          </label>
          <input
            type="text"
            name="instagram"
            placeholder="@yourhandle"
            value={formData.instagram}
            onChange={handleChange}
            className="w-full p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block font-semibold mb-1 text-white">Email</label>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-3 border border-gray-700 bg-gray-800 text-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-start space-x-2">
          <input type="checkbox" required className="mt-1 accent-indigo-500" />
          <p className="text-sm text-gray-300">
            I agree that my idea may be published and adapted by{" "}
            <strong>GramGenius</strong>, and that I will be credited if used.
          </p>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 font-semibold rounded-xl transition-all"
        >
          🚀 Submit My Idea
        </button>

        {submitted && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-green-400 font-semibold"
          >
            ✅ Thank you! Your idea has been submitted.
          </motion.p>
        )}
      </form>
    </motion.div>
  );
}
