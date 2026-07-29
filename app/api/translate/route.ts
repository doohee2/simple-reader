import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY;

const TranslateBodySchema = z.object({
  text: z.string().trim().min(1),
  mode: z.enum(["translate", "summary"]).optional().default("translate"),
  customPrompt: z.string().optional().default(""),
  model: z.string().optional().default("gemini-flash-latest"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 401 }
      );
    }

    if (!apiKey) {
      console.error("Server Error: GEMINI_API_KEY is not configured.");
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 500 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsedBody = TranslateBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "요청을 처리할 수 없습니다." },
        { status: 400 }
      );
    }

    const { text, mode, customPrompt, model } = parsedBody.data;

    const ai = new GoogleGenAI({ apiKey });
    let prompt =
      mode === "summary"
        ? `다음 텍스트의 핵심 내용을 한국어로 간결하게 요약해 주세요.\n\n[텍스트]\n${text}`
        : `다음 텍스트를 자연스럽고 매끄러운 한국어로 번역해 주세요.\n\n[텍스트]\n${text}`;

    if (customPrompt && customPrompt.trim() !== "") {
      prompt += `\n\n[추가 요청사항(사용자 지시)]\n${customPrompt.trim()}\n(위 요청사항을 최우선으로 반영하여 결과물만 깔끔하게 출력해 주세요.)`;
    }

    // 클라이언트에서 선택한 모델 사용 (기본값 fallback)
    const stream = await ai.models.generateContentStream({
      model: model || "gemini-flash-latest",
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
        } catch (err: unknown) {
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
  } catch (error: unknown) {
    console.error("Translation API Error:", error);
    return NextResponse.json(
      { error: "요청을 처리할 수 없습니다." },
      { status: 500 }
    );
  }
}
