"use client";

import { useState } from "react";
import { Upload, Send, FileText, Bot, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isUploading) return;

    const userMessage = input;
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];

    setMessages(newMessages);
    setInput("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("question", userMessage);
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.answer || data.error || "Something went wrong.",
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Failed to connect to the server." },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <FileText className="text-blue-600" /> DocAI Assistant
          </h2>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-600 block">
                {file ? file.name : "Click to upload PDF or TXT"}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">Up to 10MB</span>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-md text-sm flex items-center gap-2">
              <FileText size={16} />
              <span className="truncate">{file.name}</span>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-400 text-center">Powered by Next.js & AI</div>
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Bot size={48} className="mb-2 text-gray-300" />
              <p>Upload a document and ask any question about it!</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="p-2 bg-blue-600 text-white rounded-full">
                    <Bot size={18} />
                  </div>
                )}
                <div
                  className={`max-w-md p-4 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="p-2 bg-gray-700 text-white rounded-full">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isUploading}
              placeholder={
                isUploading
                  ? "Analyzing document..."
                  : file
                  ? "Ask anything about this document..."
                  : "Upload a file to start..."
              }
              className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 transition-colors font-medium text-sm disabled:opacity-50"
            >
              <Send size={16} /> Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}