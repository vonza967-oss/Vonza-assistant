import express from "express";
import dotenv from "dotenv";
import cors from "cors"; 
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

dotenv.config();

const app = express();

app.use(cors());  
app.use(express.json());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ROUTE
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    // 1. Fetch products
    const { data: products, error } = await supabase
      .from("products")
      .select("*");

    if (error) throw error;

    // 2. Send to AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a shopping assistant. Recommend the best product based on the user's request.",
        },
        {
          role: "user",
          content: `
User request: ${userMessage}

Products:
${JSON.stringify(products)}
          `,
        },
      ],
    });

    // 3. Return response
    res.json({
      reply: completion.choices[0].message.content,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// START SERVER
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});