import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

let llm: ChatOpenAI;

function getLLM(): ChatOpenAI {
  if (llm) return llm;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required in backend environment configuration.");
  }

  llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2000,
  });

  return llm;
}

async function invoke(systemPrompt: string, text: string): Promise<string> {
  const model = getLLM();
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(text),
  ]);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

export async function generateNotes(text: string): Promise<string> {
  return invoke(
    "You are an expert educator. Convert the following transcript into well-structured study notes with clear headings, sub-headings, and concise explanations. Use markdown formatting.",
    text
  );
}

export async function generateKeyPoints(text: string): Promise<string> {
  return invoke(
    "You are an expert educator. Extract the most important insights and key takeaways from the following content as a bulleted list. Be concise but thorough.",
    text
  );
}

export async function generateQuestions(text: string): Promise<string> {
  return invoke(
    "You are an expert educator. Generate 5-10 conceptual and interview-style questions from the following content. Include a mix of understanding, application, and analysis questions.",
    text
  );
}
