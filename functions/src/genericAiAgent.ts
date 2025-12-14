import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

// Define environment parameters
const openaiApiKey = defineSecret("OPENAI_API_KEY");

/**
 * Generic AI Agent Function
 * Accepts a JSON payload with AI configuration and input, calls OpenAI, and returns the result.
 */
export const genericAiAgent = onCall(
  {
    secrets: [openaiApiKey],
  },
  async (request) => {
    // Get the API key
    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

    // Get the JSON payload from the request
    const payload = request.data as {
      model?: string;
      temperature?: number;
      reasoning?: { effort?: string };
      task?: string;
      instructions?: {
        summary?: {
          required?: boolean;
          description?: string;
          prefix?: string;
          wordCount?: { min?: number; max?: number };
          focus?: string[];
        };
        github?: {
          required?: boolean;
          description?: string;
        };
        karmaProfile?: {
          required?: boolean;
          description?: string;
        };
      };
      outputFormat?: string;
      outputDestination?: { type?: string };
      input?: { description?: string };
    };

    const description = payload?.input?.description || "";
    const instructions = payload?.instructions || {};

    // Build the system prompt from instructions
    const buildSystemPrompt = () => {
      let prompt = `You are an expert at extracting structured information from proposal descriptions.\n\n`;
      prompt += `Task: ${payload?.task || "Extract summary and links from proposal description"}\n\n`;

      // Summary instructions
      if (instructions.summary) {
        const summaryInst = instructions.summary;
        prompt += `## Summary Extraction\n`;
        prompt += `${summaryInst.description || "Extract a concise summary"}\n`;
        if (summaryInst.focus && summaryInst.focus.length > 0) {
          prompt += `Focus on: ${summaryInst.focus.join(", ")}\n`;
        }
        if (summaryInst.wordCount) {
          prompt += `Word count: ${summaryInst.wordCount.min || 40}-${summaryInst.wordCount.max || 50} words\n`;
        }
        if (summaryInst.prefix) {
          prompt += `Prefix the summary with: "${summaryInst.prefix}"\n`;
        }
        prompt += `\n`;
      }

      // GitHub instructions
      if (instructions.github) {
        prompt += `## GitHub Repository\n`;
        prompt += `${instructions.github.description || "Extract GitHub repository link if available"}\n`;
        prompt += `\n`;
      }

      // Karma Profile instructions
      if (instructions.karmaProfile) {
        prompt += `## Karma GAP Profile\n`;
        prompt += `${instructions.karmaProfile.description || "Extract Karma GAP profile link if available"}\n`;
        prompt += `\n`;
      }

      prompt += `## Output Format\n`;
      prompt += `Return a JSON object with the following structure:\n`;
      prompt += `{\n`;
      prompt += `  "summary": "the extracted summary text",\n`;
      prompt += `  "github": "the GitHub URL or null if not found",\n`;
      prompt += `  "karmaProfile": "the Karma GAP profile URL or null if not found"\n`;
      prompt += `}\n`;
      prompt += `\nOnly return valid JSON, no additional text or markdown formatting.`;

      return prompt;
    };

    // Build the user message
    const userMessage = `Extract information from the following proposal description:\n\n${description}`;

    // Prepare headers
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Add optional headers if available
    if (process.env.OPENAI_ORG) {
      headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
    }
    if (process.env.OPENAI_PROJECT) {
      headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
    }

    try {
      // Use Responses API for all models
      const model = payload?.model || "gpt-5-nano";
      const supportsReasoning = model === "gpt-5.1" || model.startsWith("gpt-5") || model.startsWith("o1");

      const responsesPayload: any = {
        model: model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildSystemPrompt() }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userMessage }]
          }
        ]
      };

      // Add reasoning if model supports it and reasoning effort is provided
      if (supportsReasoning && payload?.reasoning?.effort && payload.reasoning.effort !== "none") {
        responsesPayload.reasoning = {
          effort: payload.reasoning.effort
        };
      }

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers,
        body: JSON.stringify(responsesPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        console.error("OpenAI API error:", response.status, errorData);
        throw new Error(`OpenAI API error: ${response.status} - ${errorData?.error?.message || JSON.stringify(errorData)}`);
      }

      const data = await response.json().catch(() => null) as any;
      console.log("responses.status", response.status, data?.id ?? "(no id)");

      // Extract response using the same pattern as userMessageHandler
      const extract = (d: any): string | null => {
        if (!d) return null;
        if (typeof d.output_text === "string" && d.output_text.trim()) return d.output_text.trim();
        const out = Array.isArray(d.output) ? d.output : [];
        for (const item of out) {
          if (item?.type === "output_text" && typeof item.text === "string") return item.text.trim();
          if (item?.type === "message" && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c?.type === "output_text" && typeof c.text === "string") return c.text.trim();
              if (c?.type === "text" && typeof c.text === "string") return c.text.trim();
              if (c?.type === "text" && typeof c.text?.value === "string") return c.text.value.trim();
            }
          }
        }
        return null;
      };

      const rawResponse = extract(data);
      if (!rawResponse) {
        throw new Error("No content in OpenAI response");
      }

      // Parse the JSON response
      let parsedResult;
      try {
        parsedResult = JSON.parse(rawResponse);
      } catch (parseError) {
        console.error("Failed to parse JSON response:", rawResponse);
        throw new Error("Invalid JSON response from OpenAI");
      }

      // Extract fields with fallbacks
      const summary = parsedResult.summary || null;
      const github = parsedResult.github || null;
      const karmaProfile = parsedResult.karmaProfile || null;

      return {
        success: true,
        result: {
          summary: summary,
          github: github,
          karmaProfile: karmaProfile,
        },
      };
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      throw new Error(`Failed to call OpenAI: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
