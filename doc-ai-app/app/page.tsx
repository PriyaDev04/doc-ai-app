"use client";

import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { Upload, FileText, LogOut, Plus, MessageSquare, Loader2, HardDrive, Bot, User } from "lucide-react";
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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFile | null>(null);
  
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  // 1. Google OAuth Sign In
  // const handleGoogleSignIn = async () => {
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: "google",
  //     options: {
  //       scopes: "https://www.googleapis.com/auth/drive.readonly",
  //       redirectTo: typeof window !== "undefined" ? `${window.location.origin}` : undefined,
  //       queryParams: {
  //         access_type: "offline",
  //         prompt: "consent",
  //       },
  //     },
  //   });
  //   if (error) toast.error(error.message);
  // };

//   const handleGoogleSignIn = async () => {
//   const { error } = await supabase.auth.signInWithOAuth({
//     provider: "google",
//     options: {
//       scopes: "https://www.googleapis.com/auth/drive.readonly",
//       redirectTo: `${window.location.origin}/auth/callback`,
//       queryParams: {
//         access_type: "offline",
//         prompt: "consent",
//       },
//     },
//   });
//   if (error) toast.error(error.message);
// };

// const handleGoogleSignIn = async () => {
//   const { error } = await supabase.auth.signInWithOAuth({
//     provider: "google",
//     options: {
//       scopes: "https://www.googleapis.com/auth/drive.readonly",
//       redirectTo: `${window.location.origin}/auth/callback`,
//       queryParams: {
//         access_type: "offline",
//         prompt: "consent",
//       },
//     },
//   });
//   if (error) toast.error(error.message);
// };

const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "https://www.googleapis.com/auth/drive.readonly",
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
  if (error) toast.error(error.message);
};

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
    toast.info("Logged out safely");
  };

  // 2. Fetch User's Drive Files
  const fetchGoogleDriveFiles = async (providerToken: string) => {
    if (!providerToken) return;
    setIsLoadingDrive(true);
    try {
      const res = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/pdf'&fields=files(id,name,mimeType)",
        { headers: { Authorization: `Bearer ${providerToken}` } }
      );
      const data = await res.json();
      if (data.files) setDriveFiles(data.files);
    } catch {
      toast.error("Failed to load Google Drive documents.");
    } finally{
      setIsLoadingDrive(false);
    }
  };

  // 3. Load Chat History
  const loadMessages = async (chatId: string) => {
    setActiveChatId(chatId);
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (data) setMessages(data as Message[]);
  };

  const createNewChat = async () => {
    if (!session?.user?.id) return;

    const { data } = await supabase
      .from("chats")
      .insert({ title: "New Document Chat", user_id: session.user.id })
      .select()
      .single();

    if (data) {
      setChats((prev) => [data, ...prev]);
      setActiveChatId(data.id);
      setMessages([]);
    }
  };

  const fetchChats = async (userId: string) => {
    const { data } = await supabase
      .from("chats")
      .select("id, title")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      setChats(data);
      loadMessages(data[0].id);
    } else {
      createNewChat();
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchChats(session.user.id);
        if (session.provider_token) {
          fetchGoogleDriveFiles(session.provider_token);
        }
      }
    });

    // Handle Auth state transitions (e.g. Google OAuth Callback Redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user?.id) {
          fetchChats(currentSession.user.id);
          
          // Check for provider token in current session or parse token from location hash
          const token = currentSession.provider_token;
          if (token) {
            fetchGoogleDriveFiles(token);
          }
        } else {
          setChats([]);
          setMessages([]);
          setActiveChatId(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 4. File Attachment Handler (Client-side notification only)
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setSelectedDriveFile(null);

    // Immediate System Message Notification in Chat Stream
    const systemNotice: Message = {
      role: "assistant",
      content: `📁 **${selectedFile.name}** is attached and ready for summary. Ask any question below to process it.`,
    };
    setMessages((prev) => [...prev, systemNotice]);
  };

  const handleDriveSelect = (driveFile: DriveFile) => {
    setSelectedDriveFile(driveFile);
    setFile(null);

    const systemNotice: Message = {
      role: "assistant",
      content: `☁️ Google Drive document **${driveFile.name}** is selected and ready. Ask your question to summarize.`,
    };
    setMessages((prev) => [...prev, systemNotice]);
  };

  // 5. Send Message (Sends data to Backend API)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !activeChatId) return;

    const userQuery = input;
    const newMessages: Message[] = [...messages, { role: "user", content: userQuery }];
    setMessages(newMessages);
    setInput("");
    setIsSending(true);

    // Save User Query to Database
    await supabase.from("messages").insert({
      chat_id: activeChatId,
      role: "user",
      content: userQuery,
    });

    try {
      const formData = new FormData();
      formData.append("question", userQuery);
      formData.append("chatId", activeChatId);

      if (file) {
        formData.append("file", file);
      } else if (selectedDriveFile && session?.provider_token) {
        formData.append("driveFileUrl", `https://www.googleapis.com/drive/v3/files/${selectedDriveFile.id}?alt=media`);
        formData.append("providerToken", session.provider_token);
      }

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      const aiResponse = data.answer || data.error || "Something went wrong.";

      setMessages([...newMessages, { role: "assistant", content: aiResponse }]);

      // Save Assistant Response to Database
      await supabase.from("messages").insert({
        chat_id: activeChatId,
        role: "assistant",
        content: aiResponse,
      });
    } catch {
      toast.error("Network error while connecting to server.");
    } finally {
      setIsSending(false);
      setFile(null);
      setSelectedDriveFile(null);
    }
  };

  // Unauthenticated Google Login View
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-6 border border-gray-100">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <FileText size={24} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">DocAI Workspace</h2>
          <p className="text-sm text-gray-500">Sign in with Google to access your Drive documents and chat history.</p>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 p-3.5 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans">
      <Toaster position="top-right" richColors />
      
      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-white border-b md:border-r border-gray-200 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" /> DocAI
            </h2>
            <button onClick={createNewChat} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition cursor-pointer">
              <Plus size={18} />
            </button>
          </div>

          {/* Chat History List */}
          <div className="space-y-1 max-h-36 overflow-y-auto">
            <span className="text-xs font-semibold text-gray-400 uppercase">Chat History</span>
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => loadMessages(chat.id)}
                className={`w-full text-left p-2 rounded-lg text-sm flex items-center gap-2 truncate cursor-pointer ${
                  activeChatId === chat.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <MessageSquare size={16} />
                <span className="truncate">{chat.title}</span>
              </button>
            ))}
          </div>

          {/* Local Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <Upload className="mx-auto h-6 w-6 text-gray-400 mb-1" />
              <span className="text-xs text-gray-600 font-medium block">
                {file ? file.name : "Attach Local File"}
              </span>
            </label>
          </div>

          {/* Google Drive Files List */}
          <div className="space-y-1 max-h-36 overflow-y-auto">
            <span className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
              <HardDrive size={12} /> From Google Drive
            </span>
            {isLoadingDrive ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                <Loader2 className="animate-spin" size={12} /> Loading Drive PDFs...
              </div>
            ) : driveFiles.length > 0 ? (
              driveFiles.map((df) => (
                <button
                  key={df.id}
                  onClick={() => handleDriveSelect(df)}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 truncate cursor-pointer ${
                    selectedDriveFile?.id === df.id ? "bg-green-50 text-green-700 font-semibold" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <FileText size={14} className="shrink-0 text-red-500" />
                  <span className="truncate">{df.name}</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-gray-400 p-2">No drive PDFs found.</p>
            )}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 text-xs text-red-600 hover:bg-red-50 p-2 rounded-lg mt-4 transition cursor-pointer"
        >
          <LogOut size={14} /> Sign Out ({session.user.email})
        </button>
      </aside>

      {/* Main Chat Stream */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </div>
              )}
              <div className={`p-4 rounded-2xl text-sm max-w-xl ${
                msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border shadow-sm"
              }`}>
                {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {/* ChatGPT-style Animated Thinking Bubble */}
          {isSending && (
            <div className="flex items-start gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="p-4 rounded-2xl bg-white border shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
        </div>

        {/* Form with Spinner inside button */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your attached document..."
              className="flex-1 border p-3 rounded-xl text-sm text-gray-800 focus:outline-blue-600"
            />
            <button
              type="submit"
              disabled={isSending}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 min-w-[90px] cursor-pointer"
            >
              {isSending ? <Loader2 className="animate-spin" size={18} /> : "Send"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}