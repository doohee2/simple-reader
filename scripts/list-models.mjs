import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log("Available models:", data.models.map(m => m.name).filter(name => name.includes("flash")));
  } else {
    console.log("Response:", data);
  }
}
listModels();
