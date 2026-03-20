import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CREDIT_COSTS: Record<string, number> = {
  AUTO_HAMMER: 10,
  HAMMER_BOULDER: 3,
  REFINE: 2,
  MORE_PEBBLES: 1,
  ANSWER: 3,
  FORGE_NARRATIVE: 15,
  FORGE_STRUCTURED: 0,
};

Deno.serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Init Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request
    const { messages, action, options = {} } = await req.json();
    if (!messages || !action) {
      return Response.json({ error: 'Missing messages or action' }, { status: 400 });
    }

    const cost = CREDIT_COSTS[action] ?? 0;

    // Check credits before calling AI
    if (cost > 0) {
      const { data: creditData } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single();

      if (!creditData || creditData.credits < cost) {
        return Response.json({
          error: 'INSUFFICIENT_CREDITS',
          credits: creditData?.credits ?? 0,
        }, { status: 402 });
      }
    }

    // Call Groq API — key is safe on server side
    const groqBody: Record<string, unknown> = {
      model: GROQ_MODEL,
      messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens ?? 8192,
    };

    if (options.jsonMode) {
      groqBody.response_format = { type: 'json_object' };
    }

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      },
      body: JSON.stringify(groqBody),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      return Response.json({ error: err?.error?.message || 'Groq API error' }, { status: 500 });
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content || '';

    // Deduct credits AFTER successful AI call
    if (cost > 0) {
      const { data: deductResult } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount: cost,
        p_action: action.toLowerCase(),
        p_description: action,
      });

      return Response.json({
        content,
        credits: deductResult?.credits ?? null,
      }, {
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    return Response.json({ content }, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
});