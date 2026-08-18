"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { Upload, FileText, LogOut, Plus, MessageSquare, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Toaster, toast } from "sonner";
import { supabase } from "./lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Chat {
  id: string;
  title: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const createNewChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("chats")
      .insert({ title: "New Document Chat", user_id: user.id })
      .select()
      .single();

    if (data) {
      setChats((prev) => [data, ...prev]);
      setActiveChatId(data.id);
      setMessages([]);
    }
  };

  const loadMessages = async (chatId: string) => {
    setActiveChatId(chatId);
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data as Message[]);
  };

  const fetchChats = async (userId: string) => {
    const { data } = await supabase
      .from("chats")
      .select("id, title")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      setChats(data);
      loadMessages(data[0].id);
    } else {
      createNewChat();
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchChats(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session: Session | null) => {
        setSession(session);
        if (session?.user?.id) {
          fetchChats(session.user.id);
        } else {
          setChats([]);
          setMessages([]);
          setActiveChatId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password.trim()) {
      setAuthError("Please fill in both email and password.");
      return;
    }

    setIsAuthLoading(true);

    if (isSignUpMode) {
      const { error } = await supabase.auth.signUp({ email, password });
      setIsAuthLoading(false);

      if (error) {
        setAuthError(error.message);
      } else {
        toast.success("Account created successfully! Check your email to confirm.");
        setIsSignUpMode(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsAuthLoading(false);

      if (error) {
        setAuthError(error.message);
      } else {
        toast.success("Successfully logged in!");
      }
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    toast.info("Logged out safely");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isUploading || !activeChatId) return;

    const userMessage = input;
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setInput("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("question", userMessage);
      formData.append("chatId", activeChatId);
      if (file) formData.append("file", file);

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.answer || data.error || "Something went wrong." },
      ]);
    } catch {
      toast.error("Network error. Could not send message.");
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Failed to connect to the server." },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
        <Toaster position="top-center" richColors />
        <form onSubmit={handleAuth} className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-4 border border-gray-100">
          <h2 className="text-2xl font-bold text-center text-gray-900">
            {isSignUpMode ? "Create an Account" : "Welcome Back"}
          </h2>
          <p className="text-sm text-center text-gray-500">
            {isSignUpMode ? "Sign up to start chatting with documents" : "Sign in to access your document chats"}
          </p>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium text-center">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-xl text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isAuthLoading}
            className="w-full bg-blue-600 text-white p-3.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isAuthLoading && <Loader2 className="animate-spin" size={16} />}
            {isAuthLoading ? "Processing..." : isSignUpMode ? "Sign Up" : "Sign In"}
          </button>

          <p className="text-xs text-center text-gray-600 pt-2">
            {isSignUpMode ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setIsSignUpMode(!isSignUpMode);
              }}
              className="text-blue-600 font-semibold hover:underline"
            >
              {isSignUpMode ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">
      <Toaster position="top-right" richColors />
      <aside className="w-full md:w-80 bg-white border-b md:border-r border-gray-200 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> DocAI
            </h2>
            <button onClick={createNewChat} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-1 max-h-40 overflow-y-auto">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => loadMessages(chat.id)}
                className={`w-full text-left p-2 rounded-lg text-sm flex items-center gap-2 truncate ${
                  activeChatId === chat.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare size={16} />
                <span className="truncate">{chat.title}</span>
              </button>
            ))}
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx,.csv,.xlsx"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0]);
                  toast.success(`Attached: ${e.target.files[0].name}`);
                }
              }}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-1" />
              <span className="text-xs text-gray-600 font-medium block">
                {file ? file.name : "Upload Document"}
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 text-xs text-red-600 hover:bg-red-50 p-2 rounded-lg mt-4 transition"
        >
          <LogOut size={14} /> Sign Out ({session.user.email})
        </button>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`p-4 rounded-xl text-sm max-w-xl ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"
              }`}>
                {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
              </div>
            </div>
          ))}
          {isUploading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="animate-spin" size={16} /> AI is thinking...
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your document..."
              className="flex-1 border p-3 rounded-lg text-sm text-gray-800 focus:outline-blue-600"
            />
            <button
              type="submit"
              disabled={isUploading}
              className="bg-blue-600 text-white px-5 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}