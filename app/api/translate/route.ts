import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const { text, mode } = await request.json();

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { error: "Text is required for translation." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt =
      mode === "summary"
        ? `다음 텍스트의 핵심 내용을 한국어로 간결하게 요약해 주세요.\n\n[텍스트]\n${text}`
        : `다음 텍스트를 자연스럽고 매끄러운 한국어로 번역해 주세요.\n\n[텍스트]\n${text}`;

    // gemini-2.0-flash 사용 (최신 안정화 버전)
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const encoder = new TextEncoder();
    
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
            }
          }
          controller.close();
        } catch (err: any) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("Translation API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
