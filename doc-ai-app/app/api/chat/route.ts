import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse-fork";
import { parseOffice } from "officeparser";

export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key missing in .env.local" },
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

        const systemPrompt = extractedText
            ? `You are an assistant answering questions based on the following document context:
---
${extractedText.slice(0, 15000)}
---
Question: ${question}`
            : question;

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
            console.error("Gemini REST API Error:", data);
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