export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed. Use POST." },
        405,
        corsHeaders,
      );
    }

    try {
      const body = await request.json();
      const messages = body.messages;

      if (!Array.isArray(messages) || messages.length === 0) {
        return jsonResponse(
          { error: "Invalid payload. Expected a non-empty messages array." },
          400,
          corsHeaders,
        );
      }

      const openAIResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages,
          }),
        },
      );

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        return jsonResponse(
          {
            error: "OpenAI request failed.",
            details: errorText,
          },
          openAIResponse.status,
          corsHeaders,
        );
      }

      const data = await openAIResponse.json();
      const reply = data.choices[0].message.content;

      if (!reply) {
        return jsonResponse(
          { error: "OpenAI returned an empty response." },
          500,
          corsHeaders,
        );
      }

      return jsonResponse({ reply }, 200, corsHeaders);
    } catch (error) {
      return jsonResponse(
        {
          error: "Worker runtime error.",
          details: error.message,
        },
        500,
        corsHeaders,
      );
    }
  },
};

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
