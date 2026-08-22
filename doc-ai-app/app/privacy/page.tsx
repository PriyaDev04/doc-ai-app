import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-6">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-xs text-gray-400">Last updated: August 2026</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Overview</h2>
            <p>
              Welcome to <strong>DocAI</strong>. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we handle your data when you sign in and interact with our application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Google OAuth & Account Access</h2>
            <p>
              DocAI uses Google Authentication solely to identify you and grant access to your saved chat history. We only access basic profile details (such as your name and email address) required for authentication.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Google Drive Integration</h2>
            <p>
              When you grant access to Google Drive, our app reads only the specific documents you explicitly select for analysis. We do not edit, delete, or store copies of your Google Drive files on our servers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. Data Protection & Sharing</h2>
            <p>
              We do not sell, rent, or transfer your personal information or Google account data to third parties. All communication between your client browser and our application is encrypted in transit using standard security protocols.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this privacy policy or your personal data, please submit your inquiry through our{" "}
              <Link href="/contact" className="text-blue-600 underline font-medium">
                Support & Privacy Request Form
              </Link>.
            </p>
          </section>
        </div>

        {/* Footer Back Link */}
        <div className="pt-6 border-t border-gray-100">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition"
          >
            <ArrowLeft size={16} /> Back to Homepage
          </Link>
        </div>

      </div>
    </div>
  );
}