import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// .env.local 파일 로드
dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY가 .env.local에 설정되지 않았습니다.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testGemini() {
  console.log("Gemini API 연결 테스트 중...");
  try {
    // 최신 모델로 시도
    const modelToTry = "gemini-2.0-flash"; 
    console.log(`\n${modelToTry} 모델로 시도합니다...`);
    
    const response = await ai.models.generateContent({
      model: modelToTry,
      contents: "안녕하세요! '연결 성공'이라고 짧게 대답해 주세요.",
    });
    
    console.log("✅ API 호출 성공!");
    console.log("응답 내용:", response.text);
  } catch (error) {
    console.error("❌ API 호출 실패:");
    console.error(error.message);
  }
}

testGemini();
