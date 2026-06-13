// supabase/functions/livepeer-upload/index.ts
// FALASTEEN.INK — Livepeer VOD upload proxy
// Holds the Livepeer API key server-side (read from the LIVEPEER_API_KEY
// function secret) and proxies Livepeer's request-upload endpoint so the
// browser never sees the key. The browser still PUTs the file bytes directly
// to the signed upload URL returned here.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const LIVEPEER_API_KEY = Deno.env.get("LIVEPEER_API_KEY");
  if (!LIVEPEER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "LIVEPEER_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { name } = await req.json().catch(() => ({ name: undefined }));

    const res = await fetch(
      "https://livepeer.studio/api/asset/request-upload",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + LIVEPEER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name || "FALASTEEN upload" }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Livepeer request-upload failed", status: res.status, details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Forward only what the client needs — never the API key.
    const uploadUrl = data?.url?.url || data?.url || data?.tusEndpoint || null;
    const payload = {
      uploadUrl,
      tusEndpoint: data?.tusEndpoint || null,
      asset: data?.asset
        ? {
            id: data.asset.id,
            playbackId: data.asset.playbackId,
            name: data.asset.name,
          }
        : null,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
