import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse-fork";
import { parseOffice } from "officeparser";

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key missing in environment variable." },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const question = formData.get("question") as string;

        if (!question) {
            return NextResponse.json({ error: "Question is required." }, { status: 400 });
        }

        let extractedText = "";

        // Parse document if attached
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

        // Strict System Instructions Guardrail
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
            // Case when user submits without uploading a file
            systemPrompt = `You are a Document AI assistant.
The user has not uploaded any document yet.
If the user asks any factual question or general knowledge question, respond with:
"Please upload a document first so I can answer questions about it!"

User Question: ${question}`;
        }

        // Request payload to Gemini API
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                }),
            }
        );

        const data = await res.json();

        if (!res.ok) {
            console.error("Gemini API Error:", data);
            return NextResponse.json(
                { error: data.error?.message || "Gemini API request failed." },
                { status: res.status }
            );
        }

        const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
        return NextResponse.json({ answer });
    } catch (error: unknown) {
        console.error("Server API Error:", error);
        return NextResponse.json(
            { error: "Failed to process document." },
            { status: 500 }
        );
    }
}