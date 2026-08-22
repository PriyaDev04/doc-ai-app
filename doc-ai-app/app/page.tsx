"use client";

import { useState, useEffect, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { 
  Upload, FileText, LogOut, Plus, MessageSquare, Loader2, 
  HardDrive, Bot, User, Trash2, Edit2, Check, X 
} from "lucide-react";
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

  // Renaming state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Ref for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

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
    setFile(null);
    setSelectedDriveFile(null);
    toast.info("Logged out safely");
  };

  const fetchGoogleDriveFiles = async (tokenOverride?: string) => {
    let token = tokenOverride;
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.provider_token || undefined;
    }

    if (!token) return;

    setIsLoadingDrive(true);
    try {
      // Allow PDFs, Text files, Word documents, and Google Docs
      const query = encodeURIComponent(
        "mimeType='application/pdf' or mimeType='text/plain' or mimeType='application/msword' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/vnd.google-apps.document'"
      );

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      
      if (data.error?.code === 401) {
        toast.error("Drive session expired. Please re-authenticate.");
      } else if (data.files) {
        setDriveFiles(data.files);
      }
    } catch {
      toast.error("Failed to load Google Drive documents.");
    } finally {
      setIsLoadingDrive(false);
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
      setFile(null);
      setSelectedDriveFile(null);
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

  // Delete Chat Handler
  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    
    await supabase.from("messages").delete().eq("chat_id", chatId);
    const { error } = await supabase.from("chats").delete().eq("id", chatId);

    if (error) {
      toast.error("Failed to delete chat.");
      return;
    }

    const updatedChats = chats.filter((c) => c.id !== chatId);
    setChats(updatedChats);
    toast.success("Chat deleted");

    if (activeChatId === chatId) {
      if (updatedChats.length > 0) {
        loadMessages(updatedChats[0].id);
      } else {
        createNewChat();
      }
    }
  };

  // Rename Chat Handlers
  const startRenaming = (e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
  };

  const saveRename = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!editingTitle.trim()) return;

    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: editingTitle } : c))
    );
    setEditingChatId(null);

    await supabase.from("chats").update({ title: editingTitle }).eq("id", chatId);
    toast.success("Chat renamed");
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        fetchChats(session.user.id);
        if (session.provider_token) {
          fetchGoogleDriveFiles(session.provider_token);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user?.id) {
          fetchChats(currentSession.user.id);
          const token = currentSession.provider_token;
          if (token) {
            fetchGoogleDriveFiles(token);
          }
        } else {
          setChats([]);
          setMessages([]);
          setActiveChatId(null);
          setFile(null);
          setSelectedDriveFile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setSelectedDriveFile(null);

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    let chatId = activeChatId;

    if (!chatId) {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from("chats")
        .insert({ title: input.slice(0, 25), user_id: session.user.id })
        .select()
        .single();

      if (!data) {
        toast.error("Failed to create a new chat session.");
        return;
      }

      setChats((prev) => [data, ...prev]);
      setActiveChatId(data.id);
      chatId = data.id;
    }

    const userQuery = input;
    const currentHistory = [...messages];
    const newMessages: Message[] = [...messages, { role: "user", content: userQuery }];
    
    setMessages(newMessages);
    setInput("");
    setIsSending(true);

    const currentChat = chats.find((c) => c.id === chatId);
    if (currentChat && currentChat.title === "New Document Chat") {
      const updatedTitle = userQuery.slice(0, 25) + (userQuery.length > 25 ? "..." : "");
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: updatedTitle } : c))
      );
      await supabase.from("chats").update({ title: updatedTitle }).eq("id", chatId);
    }

    await supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userQuery,
    });

    try {
      const formData = new FormData();
      formData.append("question", userQuery);
      formData.append("chatId", chatId || "");
      formData.append("history", JSON.stringify(currentHistory));

      if (file) {
        formData.append("file", file);
      } else if (selectedDriveFile && session?.provider_token) {
        formData.append(
          "driveFileUrl",
          `https://www.googleapis.com/drive/v3/files/${selectedDriveFile.id}?alt=media`
        );
        formData.append("providerToken", session.provider_token);
      } else {
        toast.error("No active document found. Please re-attach or select a file.");
      }

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const data = await res.json();

      const aiResponse = data.answer || data.error || "Something went wrong.";

      setMessages((prev) => [...prev, { role: "assistant", content: aiResponse }]);

      await supabase.from("messages").insert({
        chat_id: chatId,
        role: "assistant",
        content: aiResponse,
      });
    } catch {
      toast.error("Network error while connecting to server.");
    } finally {
      setIsSending(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 p-4">
        <Toaster position="top-center" richColors />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-6 border border-gray-100">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <FileText size={24} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">DocAI</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            DocAI helps you upload, process, and analyze your documents seamlessly using AI. Connect your Google Drive to analyze your files directly.
          </p>
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
          
          <div className="pt-4 border-t border-gray-100 text-xs text-gray-500">
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </div>
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
            <button
              onClick={createNewChat}
              className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition cursor-pointer"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Chat History List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <span className="text-xs font-semibold text-gray-400 uppercase">Chat History</span>
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => loadMessages(chat.id)}
                className={`group w-full p-2 rounded-lg text-sm flex items-center justify-between truncate cursor-pointer transition ${
                  activeChatId === chat.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 truncate flex-1 mr-2">
                  <MessageSquare size={16} className="shrink-0" />
                  {editingChatId === chat.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full border px-1.5 py-0.5 rounded text-xs text-gray-800 focus:outline-blue-600"
                      autoFocus
                    />
                  ) : (
                    <span className="truncate">{chat.title}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {editingChatId === chat.id ? (
                    <>
                      <button
                        onClick={(e) => saveRename(e, chat.id)}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={cancelRename}
                        className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition">
                      <button
                        onClick={(e) => startRenaming(e, chat)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="flex justify-between items-center pr-1">
              <span className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                <HardDrive size={12} /> From Google Drive
              </span>
              <button 
                onClick={handleGoogleSignIn} 
                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
              >
                Sync
              </button>
            </div>

            {isLoadingDrive ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                <Loader2 className="animate-spin" size={12} /> Loading Drive documents...
              </div>
            ) : driveFiles.length > 0 ? (
              driveFiles.map((df) => (
                <button
                  key={df.id}
                  onClick={() => handleDriveSelect(df)}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center gap-2 truncate cursor-pointer ${
                    selectedDriveFile?.id === df.id
                      ? "bg-green-50 text-green-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <FileText size={14} className="shrink-0 text-blue-500" />
                  <span className="truncate">{df.name}</span>
                </button>
              ))
            ) : (
              <div className="p-2 space-y-1">
                <p className="text-xs text-gray-400">No supported documents found.</p>
                <button
                  onClick={handleGoogleSignIn}
                  className="text-xs text-blue-600 hover:underline font-medium block cursor-pointer"
                >
                  Re-connect Google Drive
                </button>
              </div>
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
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot size={18} />
                </div>
              )}
              <div
                className={`p-4 rounded-2xl text-sm max-w-xl ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-800 border shadow-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {/* Thinking Indicator */}
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

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
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