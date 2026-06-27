import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في إدارة مصنع أعلاف اسمه FeedFlow ERP. تساعد المدير في تحليل البيانات والإنتاج والمخزون والمبيعات والموارد البشرية. أجب بالعربية دائماً بشكل مختصر وعملي ومفيد. إذا سُئلت عن بيانات محددة، قدّم أرقاماً واقعية ومعقولة لمصنع أعلاف متوسط الحجم.`;

router.post("/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI service not configured" });
    return;
  }

  const { messages, userMessage } = req.body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    userMessage: string;
  };

  if (!userMessage || typeof userMessage !== "string") {
    res.status(400).json({ error: "userMessage is required" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const history = (messages ?? []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "حسناً، أنا مساعدك الذكي لـ FeedFlow ERP." }] },
        ...history,
        { role: "user", parts: [{ text: userMessage }] },
      ],
      config: { maxOutputTokens: 8192 },
    });

    res.json({ reply: response.text ?? "" });
  } catch (err) {
    res.status(502).json({ error: "AI service request failed" });
  }
});

export default router;
