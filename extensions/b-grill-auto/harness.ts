/**
 * Answerer harness for b-grill-auto.
 *
 * Builds system/user prompts for the RPC answerer model and parses
 * structured JSON responses with fallback for malformed output.
 */

import type { AnswererResponse } from "./types.js";

/**
 * Build the system prompt for the answerer model.
 * The answerer is an expert reviewer that answers grilling questions about a plan.
 */
export function buildSystemPrompt(): string {
  return [
    "You are an expert software architect and senior engineer reviewing a technical plan.",
    "You will be asked specific questions about the plan. Answer each question thoroughly",
    "and honestly. If you identify risks, assumptions, or unknowns, state them clearly.",
    "",
    "IMPORTANT: Your response MUST be valid JSON with the following structure:",
    "",
    "```json",
    "{",
    '  "answer": "Your detailed answer to the question",',
    '  "assumptions": ["List any assumptions you are making"],',
    '  "risks": ["List any risks or concerns you identify"],',
    '  "unknowns": ["List anything you are uncertain about"],',
    '  "followUp": "A suggested follow-up question, or null if none",',
    '  "halted": false',
    "}",
    "```",
    "",
    "Rules:",
    "- The 'answer' field should be a thorough, detailed response.",
    "- Set 'halted' to true if you believe the plan has a fundamental flaw that",
    "  must be resolved before proceeding.",
    "- If you have no follow-up question, set 'followUp' to null (not the string 'null').",
    "- Be specific and technical. Avoid vague statements.",
    "- If a question is about something you cannot determine from the given context,",
    "  say so in 'unknowns' rather than guessing.",
    "",
    "Output ONLY the JSON. Do not include any text before or after the JSON object.",
  ].join("\n");
}

/**
 * Build the user prompt that includes plan context, the current question,
 * and a summary of prior Q&A for continuity.
 */
export function buildUserPrompt(
  planContent: string,
  question: string,
  questionNumber: number,
  priorQA: string,
): string {
  const parts: string[] = [];

  parts.push(`You are reviewing a technical plan. Answer question #${questionNumber}.`);
  parts.push("");

  if (priorQA) {
    parts.push("## Prior Questions and Answers");
    parts.push(priorQA);
    parts.push("");
  }

  parts.push("## Plan Content");
  // Truncate very long plans to avoid token limits
  const truncated = planContent.length > 15000
    ? planContent.slice(0, 15000) + "\n\n... [truncated]"
    : planContent;
  parts.push(truncated);
  parts.push("");

  parts.push(`## Question #${questionNumber}`);
  parts.push(question);
  parts.push("");

  return parts.join("\n");
}

/**
 * Parse a raw response string from the answerer model.
 *
 * Tries in order:
 *   1. Direct JSON.parse of the raw string
 *   2. Extract JSON from a markdown code fence (```json ... ```)
 *   3. Fallback: wrap the entire raw text as the 'answer' field
 */
export function parseResponse(raw: string): AnswererResponse {
  // Try 1: Direct JSON parse
  try {
    const parsed = JSON.parse(raw);
    return normalizeParsed(parsed);
  } catch {
    // Continue to try 2
  }

  // Try 2: Extract JSON from markdown code fence
  const codeFenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (codeFenceMatch) {
    try {
      const parsed = JSON.parse(codeFenceMatch[1]);
      return normalizeParsed(parsed);
    } catch {
      // Continue to try 3
    }
  }

  // Try 3: Look for any JSON object in the text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeParsed(parsed);
    } catch {
      // Continue to fallback
    }
  }

  // Fallback: raw text as answer
  return {
    answer: raw,
    assumptions: [],
    risks: [],
    unknowns: [],
    followUp: null,
    halted: false,
  };
}

/**
 * Normalize a parsed JSON object into an AnswererResponse.
 * Fills in missing fields with defaults.
 */
function normalizeParsed(obj: Record<string, unknown>): AnswererResponse {
  return {
    answer: typeof obj.answer === "string" ? obj.answer : JSON.stringify(obj),
    assumptions: Array.isArray(obj.assumptions)
      ? obj.assumptions.filter((x): x is string => typeof x === "string")
      : [],
    risks: Array.isArray(obj.risks)
      ? obj.risks.filter((x): x is string => typeof x === "string")
      : [],
    unknowns: Array.isArray(obj.unknowns)
      ? obj.unknowns.filter((x): x is string => typeof x === "string")
      : [],
    followUp: typeof obj.followUp === "string" ? obj.followUp : null,
    halted: obj.halted === true,
  };
}
