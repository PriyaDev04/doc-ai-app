"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle, Loader2 } from "lucide-react";

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    const formspreeUrl = process.env.NEXT_PUBLIC_FORMSPREE_URL;

    if (!formspreeUrl) {
      alert("Formspree URL is missing. Please configure NEXT_PUBLIC_FORMSPREE_URL in your environment variables.");
      setIsSending(false);
      return;
    }

    try {
      const res = await fetch(formspreeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      if (res.ok) {
        setSubmitted(true);
        setEmail("");
        setMessage("");
      } else {
        alert("Failed to send message. Please try again.");
      }
    } catch {
      alert("Network error. Please try again later.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Mail size={20} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Contact Support</h1>
        </div>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">Message Sent!</h2>
            <p className="text-xs text-gray-600">
              Thank you for reaching out. We will process your request shortly.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-xs text-blue-600 underline cursor-pointer"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Your Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help you with your privacy or data request?"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-blue-600"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSending ? <Loader2 className="animate-spin" size={18} /> : "Send Inquiry"}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-gray-100">
          <Link href="/privacy" className="inline-flex items-center gap-2 text-xs text-blue-600 hover:underline">
            <ArrowLeft size={14} /> Back to Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}