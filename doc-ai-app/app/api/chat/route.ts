import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse-fork";
import { parseOffice } from "officeparser";

// Initialize Gemini SDK with your API Key
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
    try {
        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key missing in environment variable." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const question = formData.get("question") as string;
        const driveFileUrl = formData.get("driveFileUrl") as string | null;
        const providerToken = formData.get("providerToken") as string | null;

        if (!question) {
            return NextResponse.json({ error: "Question is required." }, { status: 400 });
        }

        let extractedText = "";

        // 1. Extract text from uploaded local file
        if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());

            if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text;
            } else if (
                file.name.endsWith(".docx") ||
                file.name.endsWith(".doc") ||
                file.name.endsWith(".pptx") ||
                file.name.endsWith(".xlsx")
            ) {
                const ast = await parseOffice(buffer);
                extractedText = typeof ast === "string" ? ast : ast.toText();
            } else {
                extractedText = buffer.toString("utf-8");
            }
        }
        // 2. Fetch and extract text from Google Drive API file
        else if (driveFileUrl && providerToken) {
            const driveRes = await fetch(driveFileUrl, {
                headers: { Authorization: `Bearer ${providerToken}` },
            });

            if (driveRes.ok) {
                const contentType = driveRes.headers.get("content-type") || "";
                const arrayBuf = await driveRes.arrayBuffer();
                const buffer = Buffer.from(arrayBuf);

                if (contentType.includes("application/pdf") || driveFileUrl.includes("alt=media")) {
                    try {
                        const pdfData = await pdfParse(buffer);
                        extractedText = pdfData.text;
                    } catch {
                        extractedText = buffer.toString("utf-8");
                    }
                } else if (
                    contentType.includes("word") ||
                    contentType.includes("officedocument") ||
                    contentType.includes("presentation") ||
                    contentType.includes("spreadsheet")
                ) {
                    const ast = await parseOffice(buffer);
                    extractedText = typeof ast === "string" ? ast : ast.toText();
                } else {
                    extractedText = buffer.toString("utf-8");
                }
            } else {
                return NextResponse.json(
                    { error: "Failed to download document from Google Drive. Check permissions." },
                    { status: 400 }
                );
            }
        }

        // 3. Build Strict System Guardrail Prompt
        let systemPrompt = "";

        if (extractedText.trim()) {
            systemPrompt = `You are a strict, dedicated Document AI assistant.
Your ONLY task is to answer user questions using information strictly found within the provided document context below.

DOCUMENT CONTEXT:
---
${extractedText.slice(0, 30000)}
---

STRICT RULES & GUARDRAILS:
1. Answer the user's question ONLY if the answer can be directly derived from the document context provided above.
2. If the user asks a question that is NOT related to or answered by the uploaded document context, respond with exact text:
   "I can only answer questions related to your uploaded document. The provided document does not contain information to answer this question."
3. Do NOT use outside general knowledge, web facts, or answer general trivia.
4. Keep answers factual, concise, and grounded strictly in the context.

User Question: ${question}`;
        } else {
            systemPrompt = `You are a Document AI assistant.
The user has not uploaded any document or selected a Google Drive file yet.
If the user asks any factual question or general knowledge question, respond with:
"Please upload or select a document first so I can answer questions about it!"

User Question: ${question}`;
        }

        // 4. Generate response using updated Gemini 3.6 Flash endpoint
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        return NextResponse.json({ answer: responseText });
    } catch (error: unknown) {
        console.error("Server API Error:", error);
        return NextResponse.json(
            { error: "Failed to process document." },
            { status: 500 }
        );
    }
}