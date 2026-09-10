// Structured-output schema passed as `response_format.json_schema` on the
// Groq chat completion in POST /api/agent/configure. Forces the model's JSON
// to always match the "Response contract" documented alongside
// `agent_config_system_prompt` (constant/prompts.ts) — either clarification
// questions, or a full agent config, never free-form text.
//
// Groq's strict structured-output mode requires every property to be listed
// in `required` and every object to set `additionalProperties: false` —
// there's no "optional key", so a value that can be absent is instead typed
// as `["<type>", "null"]` and always present (possibly `null`).
export const agent_config_response = {
  name: "agent_config_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["ready", "needs_clarification"],
        description:
          "\"needs_clarification\" when essential information is missing or ambiguous; \"ready\" once the config can be fully generated.",
      },
      clarificationQuestions: {
        type: "array",
        description:
          "Questions to ask the user before a config can be generated. Empty array when status is \"ready\".",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "string",
              description: "Stable identifier for this question, e.g. \"calendar_service\".",
            },
            question: {
              type: "string",
              description: "The question text shown to the user.",
            },
            type: {
              type: "string",
              enum: ["text", "single_select", "multi_select", "number", "time", "date"],
              description: "How the question should be answered.",
            },
            options: {
              type: "array",
              items: { type: "string" },
              description:
                "Selectable options for \"single_select\"/\"multi_select\" questions. Empty array for \"text\".",
            },
            allowCustom: {
              type: "boolean",
              description: "Whether the user may type a custom answer instead of picking an option.",
            },
            customPlaceholder: {
              type: "string",
              description: "Placeholder text for the custom-answer input. Empty string when allowCustom is false.",
            },
          },
          required: ["id", "question", "type", "options", "allowCustom", "customPlaceholder"],
        },
      },
      config: {
        description: "The fully generated agent configuration. Null when status is \"needs_clarification\".",
        type: ["object", "null"],
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Short, human-friendly agent name (2-5 words), title case.",
          },
          description: {
            type: "string",
            description: "One sentence describing the agent, shown in a list of the user's agents.",
          },
          objective: {
            type: "string",
            description:
              "The single outcome the agent is responsible for, written as an instruction to the agent itself.",
          },
          instructions: {
            type: "string",
            description: "Step-by-step operating instructions the agent follows each run.",
          },
          tools: {
            type: "array",
            items: { type: "string" },
            description: "Tool slugs the agent needs, drawn only from the available tools list.",
          },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Short capability tags describing what the agent does, e.g. \"web_research\".",
          },
          schedule: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: ["manual", "once", "recurring"],
                description:
                  "\"manual\" when the user never mentions timing, \"once\" for a single run, \"recurring\" for anything repeating.",
              },
              frequency: {
                type: ["string", "null"],
                enum: ["daily", "weekly", "monthly", null],
                description: "Only set when schedule.type is \"recurring\"; null otherwise.",
              },
              time: {
                type: ["string", "null"],
                description: "24-hour \"HH:mm\" string. Null when schedule.type is \"manual\".",
              },
            },
            required: ["type", "frequency", "time"],
          },
          outputFormat: {
            type: "string",
            description: "Short description of how results should be delivered/structured.",
          },
        },
        required: ["name", "description", "objective", "instructions", "tools", "skills", "schedule", "outputFormat"],
      },
    },
    required: ["status", "clarificationQuestions", "config"],
  },
}
