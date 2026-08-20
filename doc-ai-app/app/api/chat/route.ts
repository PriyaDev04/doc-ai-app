import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse-fork";
import { parseOffice } from "officeparser";

export const maxDuration = 60; // Prevents timeouts on heavy PDF OCR tasks

const apiKey = process.env.GEMINI_API_KEY || "";

interface InlineDataPart {
    inline_data: {
        mime_type: string;
        data: string;
    };
}

interface TextPart {
    text: string;
}

type GeminiPart = InlineDataPart | TextPart;

interface GeminiContent {
    role: string;
    parts: GeminiPart[];
}

interface GeminiApiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
}

export async function POST(req: NextRequest) {
    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key missing in environment variables." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const rawFile = formData.get("file");
        const question = formData.get("question") as string;
        const driveFileUrl = formData.get("driveFileUrl") as string | null;
        const providerToken = formData.get("providerToken") as string | null;
        const historyJson = formData.get("history") as string | null;

        if (!question) {
            return NextResponse.json({ error: "Question is required." }, { status: 400 });
        }

        const file = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;

        let extractedText = "";
        let inlinePdfPart: { inlineData: { mimeType: string; data: string } } | null = null;

        // Helper to process document buffer and extract text or prepare inline vision data
        async function processDocumentBuffer(buffer: Buffer, isPdf: boolean) {
            if (isPdf) {
                try {
                    const pdfData = await pdfParse(buffer);
                    extractedText = pdfData?.text || "";
                } catch {
                    extractedText = "";
                }

                const printableText = extractedText.replace(/\s+/g, "");

                // If no text layer exists (scanned/image PDF), fallback to multimodal OCR
                if (printableText.length === 0) {
                    extractedText = "";
                    inlinePdfPart = {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: buffer.toString("base64"),
                        },
                    };
                }
            } else {
                try {
                    const ast = await parseOffice(buffer);
                    extractedText = typeof ast === "string" ? ast : ast.toText();
                } catch {
                    extractedText = buffer.toString("utf-8");
                }
            }
        }

        // 1. Process Local File
        if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            await processDocumentBuffer(buffer, isPdf);
        }
        // 2. Process Google Drive File
        else if (driveFileUrl && providerToken) {
            const driveRes = await fetch(driveFileUrl, {
                headers: { Authorization: `Bearer ${providerToken}` },
            });

            if (driveRes.ok) {
                const contentType = driveRes.headers.get("content-type") || "";
                const arrayBuf = await driveRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);
                const isPdf = contentType.includes("application/pdf") || driveFileUrl.includes("alt=media");

                await processDocumentBuffer(buffer, isPdf);
            } else {
                return NextResponse.json(
                    { error: "Failed to download document from Google Drive." },
                    { status: 400 }
                );
            }
        }

        // 3. Format History
        let parsedHistory: Array<{ role: string; content: string }> = [];
        if (historyJson) {
            try {
                parsedHistory = JSON.parse(historyJson);
            } catch {
                parsedHistory = [];
            }
        }

        const formattedHistory = parsedHistory
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        // 4. Construct Prompt Context
        let promptText = "";

        if (extractedText.trim()) {
            promptText = `You are a dedicated Document AI assistant.
Answer questions strictly based on the document text provided below.

DOCUMENT CONTEXT:
---
${extractedText.slice(0, 30000)}
---

CONVERSATION HISTORY:
${formattedHistory || "None"}

Current Question: ${question}`;
        } else if (inlinePdfPart) {
            promptText = `You are an expert Document AI and Optical Character Recognition (OCR) engine.
A scanned/image PDF document is provided directly. Read all visible text, tables, and contents visually and answer the question accurately.

CONVERSATION HISTORY:
${formattedHistory || "None"}

Current Question: ${question}`;
        } else {
            promptText = `You are a Document AI assistant.
CONVERSATION HISTORY:
${formattedHistory || "None"}

Current Question: ${question}`;
        }

        // 5. Construct Payload for Direct Gemini REST Call
        const contentsPayload: GeminiContent[] = [];

        if (inlinePdfPart) {
            const pdfDataPart = inlinePdfPart as { inlineData: { mimeType: string; data: string } };
            const base64Data = pdfDataPart.inlineData.data;

            contentsPayload.push({
                role: "user",
                parts: [
                    { inline_data: { mime_type: "application/pdf", data: base64Data } },
                    { text: promptText },
                ],
            });
        } else {
            contentsPayload.push({
                role: "user",
                parts: [{ text: promptText }],
            });
        }

        // Direct REST API Call using v1beta URL
        // Direct REST API Call using gemini-2.0-flash on v1beta
        // Direct REST API Call using gemini-3.6-flash
        const googleResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: contentsPayload }),
            }
        );

        const data: GeminiApiResponse = await googleResponse.json();

        if (!googleResponse.ok) {
            console.error("Gemini API Error Payload:", data);
            return NextResponse.json(
                { error: data?.error?.message || "Error communicating with Gemini API." },
                { status: googleResponse.status }
            );
        }

        const answer =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "No response generated from model.";

        return NextResponse.json({ answer });


    } catch (error: unknown) {
        console.error("Server API Error:", error);
        const errorMessage =
            error instanceof Error ? error.message : "Failed to process document.";

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}