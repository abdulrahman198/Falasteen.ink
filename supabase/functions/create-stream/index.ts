import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const LIVEPEER_API_KEY = Deno.env.get('LIVEPEER_API_KEY')
  if (!LIVEPEER_API_KEY) {
    return new Response(JSON.stringify({ error: 'LIVEPEER_API_KEY is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { title } = await req.json()

    const res = await fetch('https://livepeer.studio/api/stream', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LIVEPEER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: title || 'بث مباشر',
        profiles: [
          { name: '720p', bitrate: 2000000, fps: 30, width: 1280, height: 720 },
          { name: '480p', bitrate: 1000000, fps: 30, width: 854, height: 480 },
        ]
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
