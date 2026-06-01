import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Ensure express limit is high enough for base64 image transfer
const app = express();
app.use(express.json({ limit: '15mb' }));
const PORT = 3000;

// Lazy initialize Gemini SDK client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Receipt OCR analysis helper with retries and multiple model fallbacks
async function generateContentWithFallback(
  ai: ReturnType<typeof getGenAI>,
  contents: any,
  config: any
): Promise<any> {
  // A resilient sequence of models to try. We prioritize models that have separate quotas/allocations.
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  // We will perform up to 2 full cycles/rounds of checking all available models.
  // In the first round, if a model yields 503/429, we skip to the next model INSTANTLY without delaying the user.
  // In the second round, we add a brief delay backoff to handle general rate limit resets.
  for (let round = 1; round <= 2; round++) {
    console.log(`[OCR] Starting round ${round}/2 of model evaluation sequence...`);
    
    for (const modelName of models) {
      try {
        console.log(`[OCR] Trying model: ${modelName} in round ${round}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });
        console.log(`[OCR] Successfully processed with model: ${modelName} during round ${round}`);
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || JSON.stringify(err);
        
        // Analyze if the error is a rate limit or service overload (transient)
        const status = err.status || err.code;
        const isTransient =
          status === 503 ||
          status === 429 ||
          err.status === "UNAVAILABLE" ||
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("temp") ||
          errMsg.includes("demand") ||
          errMsg.includes("Please try again later");

        // Clean and sanitize the log message to avoid raw "error" JSON strings in stderr
        const logDetail = isTransient 
          ? "Service temporarily overloaded or experiencing high demand. Self-healing fallback taking place..." 
          : errMsg.substring(0, 120);

        console.log(`[OCR INFO] Model "${modelName}" bypassed in round ${round} [Details: ${logDetail}]`);

        if (!isTransient) {
          // If it's a structural error (like incorrect schema or invalid image format),
          // don't waste time trying other models or rounds. Throw immediately.
          throw err;
        }
      }
    }

    // If we finished the first round and all models failed with transient errors, 
    // wait a brief period before starting the second round to let the backend systems recover.
    if (round < 2) {
      console.warn("[OCR] All models returned transient errors. Standing by 1200ms before starting round 2...");
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  // If we've made it here, all attempts with all models in both rounds failed
  throw lastError || new Error("發票 OCR 分析失敗（連線異常或所有備選 AI 模型均處於高負載狀態，請稍後重試）");
}

// Receipt OCR analysis route using Node.js Gemini SDK
app.post("/api/ocr-receipt", async (req, res) => {
  try {
    const { image } = req.body; // Base64 image data (including or excluding prefix)
    
    if (!image) {
      return res.status(400).json({ error: "Missing image data" });
    }

    // Strip out base64 prefix if present
    let mimeType = "image/jpeg";
    let base64Data = image;
    const match = image.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    const ai = getGenAI();

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      },
      "請辨識此發票或收據影像中的消費日期、消費類別、總金額及簡短備註。日期的格式請轉換為 YYYY-MM-DD，若找不到正確日期則默認今天。類別必須嚴格分類為：'會議餐點'、'電腦周邊'、'文具用品' 或 '其他'。金額請提供整數。備註請提取買了什麼主要品項或商家店名。"
    ];

    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          date: { 
            type: Type.STRING, 
            description: "消費日期，格式必須是 YYYY-MM-DD" 
          },
          category: { 
            type: Type.STRING, 
            description: "消費類別，只能是：'會議餐點', '電腦周邊', '文具用品', '其他' 之一" 
          },
          amount: { 
            type: Type.INTEGER, 
            description: "消費總金額 (新台幣)，為大於 0 的整數數字" 
          },
          remark: { 
            type: Type.STRING, 
            description: "備註說明，描述商家店名與買了什麼品項" 
          }
        },
        required: ["date", "category", "amount", "remark"]
      }
    };

    const response = await generateContentWithFallback(ai, contents, config);

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Could not extract text response from Gemini");
    }

    const parsed = JSON.parse(resultText.trim());
    res.json(parsed);

  } catch (error: any) {
    console.error("Receipt OCR API Error:", error);
    res.status(500).json({ 
      error: error.message || "發票辨識失敗，請重試或確認 API 密鑰設置" 
    });
  }
});

// Setup dev vs production environment serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
