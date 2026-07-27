// IA desativada temporariamente — funcionalidade "Em Obras" no painel admin.
// O código original está comentado abaixo e será reativado quando um novo
// provedor de IA for configurado.
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ error: "Recurso de IA temporariamente indisponível" }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

// ─────────────────────────────────────────────────────────────
// CÓDIGO ORIGINAL — COMENTADO PARA PRODUÇÃO
// ─────────────────────────────────────────────────────────────
//
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { getCorsHeaders } from "../_shared/cors.ts";
// 
// // ── FOOD PHOTOGRAPHY AI ENGINE ──
// // 100% focado em gastronomia. Cada prompt é otimizado para REALISMO FOTOGRÁFICO.
// // Modelo: Gemini 3 Pro Image (máxima qualidade de geração de imagem)
// 
// const ASPECT_RATIO_PROMPTS: Record<string, string> = {
//   "9:16": "Vertical 9:16 portrait orientation, composed for mobile-first viewing. The dish fills at least 70% of the frame vertically.",
//   "16:9": "Horizontal 16:9 landscape orientation. Use the width to show plating context and environment, with the dish as the clear focal point.",
//   "1:1": "Perfect 1:1 square format. Tight, centered framing on the dish with minimal distractions.",
//   "4:5": "Vertical 4:5 portrait format (Instagram feed). The dish dominates the frame with just enough environment to set the mood.",
// };
// 
// // Core photorealism instructions — appended to every prompt
// const PHOTOREALISM_CORE = `
// CRITICAL RULES FOR MAXIMUM PHOTOREALISM:
// - This MUST look like an actual photograph taken with a professional DSLR camera, NOT a digital illustration or AI-generated art.
// - Real-world physics: gravity affects sauces, steam rises naturally, cheese melts with realistic viscosity, liquids have proper surface tension and reflections.
// - Imperfections that prove reality: slight asymmetry in plating, a tiny crumb on the plate edge, natural color variations in ingredients, micro-bubbles in beverages.
// - Lighting must behave like real light: soft shadows with penumbra, specular highlights on wet/glossy surfaces, light absorption in translucent ingredients (lettuce, thin slices, beverages).
// - Depth of field: shallow (f/1.8–f/2.8) with creamy bokeh. The sharpest focus is on the most appetizing texture (the crispy crust, the melting cheese, the glistening glaze).
// - Color science: natural white balance (slightly warm at 5500K–6000K), no oversaturation, skin-like warmth in bread and pastry tones.
// - Surface textures must be photorealistic: the grain of wood tables, the weave of linen napkins, the fingerprints on a cold glass, condensation droplets.
// - NO text, NO watermarks, NO logos, NO borders, NO frames, NO humans, NO hands, NO fingers.
// - The image should be indistinguishable from a photograph in a Michelin-starred restaurant's press kit.
// `.trim();
// 
// function buildPrompt(
//   generationType: string,
//   itemName: string,
//   itemDesc: string,
//   restaurantName: string,
//   aspectRatio: string,
//   customPrompt: string,
//   hasReference: boolean
// ): string {
//   const ratioInstruction = ASPECT_RATIO_PROMPTS[aspectRatio] || ASPECT_RATIO_PROMPTS["1:1"];
//   const referenceNote = hasReference
//     ? " Use the provided reference image as the PRIMARY visual guide — replicate the exact food item, plating, and ingredients shown but elevate the quality to professional food photography standards. Keep the dish recognizable."
//     : "";
//   const descContext = itemDesc ? ` The dish consists of: ${itemDesc}.` : "";
//   const userDirection = customPrompt ? ` Creative direction from the chef: "${customPrompt}".` : "";
// 
//   if (generationType === "ad_creative") {
//     return `Professional food advertisement photograph for a restaurant.${userDirection} Dish: "${itemName}".${descContext}
// 
// STYLE: High-end restaurant advertising campaign. The food is the absolute hero — shot from a slightly elevated 30-degree angle that shows both the top and the depth/layers of the dish. The environment suggests a premium dining experience with blurred background elements (warm ambient lighting, dark wood, subtle candlelight bokeh).
// 
// LIGHTING: Dramatic three-point lighting setup — warm key light (golden hour tone) from the upper left creating gorgeous highlights on glossy/wet surfaces, soft fill from the right to open shadows, and a subtle rim/backlight that separates the dish from the background and illuminates rising steam.
// 
// Include bold, elegant promotional text overlay: the dish name "${itemName}" in a modern serif font, and a short appetite-triggering tagline in Portuguese. Text has subtle drop shadow for readability. Layout: food 65% of frame, text 25%, breathing space 10%.
// 
// ${ratioInstruction}
// ${PHOTOREALISM_CORE}${referenceNote}`;
//   }
// 
//   if (generationType === "social_post") {
//     return `Viral-worthy food photograph for Instagram/social media.${userDirection} Dish: "${itemName}" from ${restaurantName}.${descContext}
// 
// STYLE: The kind of photo that stops someone mid-scroll and makes them screenshot it. Shot from directly above (flat lay) OR a dramatic 15-degree low angle that makes the food look monumental. Modern food influencer aesthetic but elevated to professional quality.
// 
// LIGHTING: Natural window light from one side, creating soft directional shadows that reveal every texture — the crispy edges, the creamy centers, the fresh herbs. Slight warmth in the highlights. The food should glisten and look like it was JUST plated seconds ago.
// 
// ATMOSPHERE: Visible signs of freshness — a wisp of steam, condensation on a cold glass nearby, a fresh herb leaf with a water droplet. The scene tells a story of a meal at its peak moment. Background has complementary elements (rustic cutting board, scattered ingredients, a linen napkin) but nothing competes with the hero dish.
// 
// ${ratioInstruction}
// ${PHOTOREALISM_CORE}${referenceNote}`;
//   }
// 
//   if (generationType === "ugc_content") {
//     return `Ultra-realistic UGC (User Generated Content) style food marketing photograph featuring a REAL PERSON.${userDirection} Dish: "${itemName}" from ${restaurantName}.${descContext}
// 
// MANDATORY — HUMAN PRESENCE:
// - A real, attractive person (food influencer / content creator type) is prominently featured in the photo.
// - The person is naturally interacting with the food: holding the dish, taking a bite, smiling while looking at the food, holding up a fork with a perfect bite, or presenting the plate to the camera.
// - Their expression conveys genuine delight and satisfaction — the kind of authentic reaction that makes viewers trust the recommendation.
// - The person should look like a real content creator, NOT a stock photo model. Natural makeup, casual-chic style, relatable and aspirational at the same time.
// - Hands and fingers must look natural and anatomically correct with proper proportions.
// 
// STYLE: This should look like an organic Instagram/TikTok post from a popular food influencer — NOT a staged advertisement. The "accidental perfection" of UGC: slightly candid angle, natural environment (restaurant table, kitchen counter, outdoor dining), genuine moment captured.
// 
// LIGHTING: Natural, ambient lighting as if shot with a high-end smartphone or mirrorless camera. Warm tones, soft window light or golden hour glow. The lighting flatters both the person AND the food equally.
// 
// COMPOSITION: The person takes up 40-60% of the frame, with the food clearly visible and appetizing. Shot from a natural selfie-like angle OR a friend's perspective across the table. Shallow depth of field separates subject from the busy restaurant/café background.
// 
// ATMOSPHERE: Real restaurant or café environment visible in the background — other diners blurred out, warm ambient lighting, actual table setting with drinks, napkins. The scene feels lived-in and authentic, like you're peeking into someone's real dining experience.
// 
// ${ratioInstruction}
// 
// CRITICAL PHOTOREALISM RULES:
// - This MUST look like an actual photograph, NOT AI-generated art or illustration.
// - The person must have realistic skin texture, natural facial features, proper anatomy, and believable proportions.
// - Real-world physics apply: food has proper weight, sauces drip naturally, steam rises realistically.
// - The food must look as appetizing as in a professional food photo while maintaining the casual UGC aesthetic.
// - Lighting behaves like real light with soft shadows, specular highlights on wet surfaces.
// - NO text, NO watermarks, NO logos, NO borders, NO frames.
// - The image should be indistinguishable from a real food influencer's Instagram post.${referenceNote}`;
//   }
// 
//   if (generationType === "product_photo") {
//     return `Ultra-realistic professional menu photograph.${userDirection} Dish: "${itemName}".${descContext}
// 
// STYLE: This is a hero shot for a premium restaurant's digital menu. The goal is to make the viewer's mouth water and choose THIS dish over everything else. Shot with a Canon EOS R5 and a 100mm f/2.8 macro lens at f/2.8, creating beautiful subject isolation with creamy bokeh.
// 
// LIGHTING: Soft, directional key light from a large diffused source (simulating a north-facing window), filling the shadows just enough to reveal detail without flattening the image. Subtle warm backlight rim that makes steam, vapor, and glossy surfaces glow. Color temperature around 5600K — natural, warm, and inviting.
// 
// COMPOSITION: Rule of thirds placement. The most appetizing element (the cross-section, the cheese pull, the sauce drizzle, the crispy crust) is at the primary focal point. Shallow depth of field draws the eye exactly where desire peaks. Background is clean — either a dark, moody surface (black slate, dark wood) or a bright, minimal surface (white marble, light linen) depending on the dish character.
// 
// FOOD STYLING: The dish looks perfect but REAL — not artificially arranged. Sauce has natural flow patterns, garnishes sit naturally, steam rises in organic wisps. Every ingredient is identifiable and looks fresh, vibrant, and at peak ripeness/doneness.
// 
// ${ratioInstruction}
// ${PHOTOREALISM_CORE}${referenceNote}`;
//   }
// 
//   if (generationType === "product_video") {
//     return `Cinematic food photograph — the hero frame of a premium video commercial.${userDirection} Dish: "${itemName}".${descContext}
// 
// STYLE: This single frame should look like a pause from a Super Bowl food commercial or a Netflix food documentary. Shot on a cinema camera (RED V-Raptor) with an anamorphic lens — subtle horizontal lens flares from specular highlights on the food, cinematic 2.39:1 feel even in the chosen ratio.
// 
// LIGHTING: Moody, cinematic three-point lighting with strong contrast ratio. Warm golden key light creates dramatic highlights on the food's surfaces. Deep, rich shadows add mystery and depth. A subtle cyan-tinted fill prevents shadows from going completely black. Backlight creates a glowing halo around rising steam/vapor.
// 
// ATMOSPHERE: This is the PEAK MOMENT — the cheese is mid-stretch, the sauce is mid-pour, the steam is at its most photogenic wisp. Everything frozen at the instant of maximum desire. Dark, luxurious background with subtle bokeh points of warm light.
// 
// ${ratioInstruction}
// ${PHOTOREALISM_CORE}${referenceNote}`;
//   }
// 
//   // Fallback
//   return `Professional food photograph of "${itemName}".${userDirection}${descContext} Shot with natural lighting, shallow depth of field, photorealistic quality. ${ratioInstruction} ${PHOTOREALISM_CORE}${referenceNote}`;
// }
// 
// serve(async (req) => {
//   const origin = req.headers.get("origin");
//   const corsHeaders = getCorsHeaders(origin);
// 
//   if (req.method === "OPTIONS") {
//     return new Response(null, { headers: corsHeaders });
//   }
// 
//   try {
//     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
//     if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
// 
//     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
//     const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// 
//     const authHeader = req.headers.get("authorization");
//     if (!authHeader) {
//       return new Response(JSON.stringify({ error: "Unauthorized" }), {
//         status: 401,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
//       global: { headers: { Authorization: authHeader } },
//     });
//     const { data: { user }, error: authError } = await userClient.auth.getUser();
//     if (authError || !user) {
//       return new Response(JSON.stringify({ error: "Unauthorized" }), {
//         status: 401,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// 
//     const { generation_type, product_id, restaurant_id, custom_prompt, reference_image_url, aspect_ratio } = await req.json();
// 
//     const selectedRatio = aspect_ratio || "1:1";
// 
//     // Validate restaurant access (owner, collaborator, or master)
//     const { data: restaurant } = await adminClient
//       .from("restaurants")
//       .select("id, name, user_id")
//       .eq("id", restaurant_id)
//       .single();
// 
//     if (!restaurant) {
//       return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), {
//         status: 403,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // Check access: owner, collaborator, or master
//     const isOwner = restaurant.user_id === user.id;
//     const { data: collabLink } = await adminClient
//       .from("restaurant_collaborators")
//       .select("id")
//       .eq("restaurant_id", restaurant_id)
//       .eq("user_id", user.id)
//       .maybeSingle();
//     const { data: masterRole } = await adminClient
//       .from("user_roles")
//       .select("id")
//       .eq("user_id", user.id)
//       .eq("role", "master")
//       .maybeSingle();
// 
//     if (!isOwner && !collabLink && !masterRole) {
//       return new Response(JSON.stringify({ error: "Sem permissão para este restaurante" }), {
//         status: 403,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // Determine credits cost
//     const creditsCost = generation_type === "ugc_video" ? 5 : generation_type === "ugc_content" ? 2 : generation_type === "ad_creative" ? 2 : generation_type === "product_video" ? 3 : 1;
// 
//     // Check credits balance
//     const { data: credits } = await adminClient
//       .from("ai_credits")
//       .select("balance")
//       .eq("restaurant_id", restaurant_id)
//       .single();
// 
//     if (!credits || credits.balance < creditsCost) {
//       return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
//         status: 402,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // Get product info if provided
//     let productInfo: any = null;
//     if (product_id) {
//       const { data: product } = await adminClient
//         .from("products")
//         .select("name, description, price, image_url")
//         .eq("id", product_id)
//         .single();
//       productInfo = product;
//     }
// 
//     const itemName = productInfo?.name || (custom_prompt ? "item gastronômico" : "prato do chef");
//     const itemDesc = productInfo?.description || "";
//     const hasReference = !!reference_image_url;
// 
//     // Validate supported generation types
//     const supportedTypes = ["product_photo", "social_post", "ad_creative", "product_video", "ugc_content", "ugc_video"];
//     if (!supportedTypes.includes(generation_type)) {
//       return new Response(JSON.stringify({ error: "Tipo de geração não suportado." }), {
//         status: 400,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // Gemini 3 Pro Image — máxima qualidade para geração de imagens
//     const aiModel = "google/gemini-3-pro-image-preview";
// 
//     const prompt = buildPrompt(
//       generation_type,
//       itemName,
//       itemDesc,
//       restaurant.name,
//       selectedRatio,
//       custom_prompt || "",
//       hasReference
//     );
// 
//     console.log(`Generating ${generation_type} (${selectedRatio}) for: ${itemName} | Model: ${aiModel}`);
// 
//     // Build AI request
//     const refUrl = reference_image_url || (productInfo?.image_url || null);
//     const messages: any[] = [];
//     if (refUrl) {
//       messages.push({
//         role: "user",
//         content: [
//           { type: "text", text: prompt },
//           { type: "image_url", image_url: { url: refUrl } },
//         ],
//       });
//     } else {
//       messages.push({ role: "user", content: prompt });
//     }
// 
//     const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${LOVABLE_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({ model: aiModel, messages, modalities: ["image", "text"] }),
//     });
// 
//     if (!resp.ok) {
//       const errText = await resp.text();
//       console.error("AI error:", resp.status, errText);
// 
//       // Create failed generation record
//       await adminClient.from("ai_generations").insert({
//         restaurant_id,
//         product_id: product_id || null,
//         generation_type,
//         prompt: prompt.slice(0, 500),
//         credits_used: creditsCost,
//         status: "failed",
//       });
// 
//       if (resp.status === 429) {
//         return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns minutos." }), {
//           status: 429,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
//       if (resp.status === 402) {
//         return new Response(JSON.stringify({ error: "Créditos da plataforma esgotados. Entre em contato com o suporte." }), {
//           status: 402,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       return new Response(JSON.stringify({ error: "IA não conseguiu gerar a imagem. Tente novamente." }), {
//         status: 500,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     const data = await resp.json();
//     const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
// 
//     if (!generatedImage) {
//       await adminClient.from("ai_generations").insert({
//         restaurant_id,
//         product_id: product_id || null,
//         generation_type,
//         prompt: prompt.slice(0, 500),
//         credits_used: creditsCost,
//         status: "failed",
//       });
// 
//       return new Response(JSON.stringify({ error: "IA não retornou imagem. Tente com outra referência ou prompt." }), {
//         status: 500,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // Create generation record
//     const { data: generation, error: genError } = await adminClient
//       .from("ai_generations")
//       .insert({
//         restaurant_id,
//         product_id: product_id || null,
//         generation_type,
//         prompt: prompt.slice(0, 500),
//         credits_used: creditsCost,
//         status: "pending",
//       })
//       .select()
//       .single();
// 
//     if (genError) throw genError;
// 
//     // Upload image
//     const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
//     const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
//     const fileName = `ai-generated/${restaurant_id}/${generation.id}.png`;
//     const { error: uploadError } = await adminClient.storage
//       .from("product-images")
//       .upload(fileName, imageBytes, { contentType: "image/png", upsert: true });
//     if (uploadError) throw uploadError;
//     const { data: { publicUrl } } = adminClient.storage.from("product-images").getPublicUrl(fileName);
// 
//     // Update generation with result URL
//     await adminClient.from("ai_generations").update({
//       result_url: publicUrl,
//       status: "completed",
//     }).eq("id", generation.id);
// 
//     // Deduct credits
//     await adminClient.from("ai_credits").update({
//       balance: credits.balance - creditsCost,
//       total_used: (await adminClient.from("ai_credits").select("total_used").eq("restaurant_id", restaurant_id).single()).data!.total_used + creditsCost,
//     }).eq("restaurant_id", restaurant_id);
// 
//     // Record transaction
//     const typeLabel = generation_type === "product_photo"
//       ? `Foto: ${productInfo?.name || "Produto"}`
//       : generation_type === "ad_creative"
//       ? `Anúncio: ${productInfo?.name || restaurant.name}`
//       : generation_type === "ugc_content"
//       ? `UGC Foto: ${productInfo?.name || restaurant.name}`
//       : generation_type === "ugc_video"
//       ? `UGC Vídeo: ${productInfo?.name || restaurant.name}`
//       : `Vídeo: ${productInfo?.name || restaurant.name}`;
// 
//     await adminClient.from("ai_credit_transactions").insert({
//       restaurant_id,
//       amount: -creditsCost,
//       type: "usage",
//       description: typeLabel,
//       generation_type,
//     });
// 
//     return new Response(JSON.stringify({
//       success: true,
//       generation_id: generation.id,
//       result_url: publicUrl,
//       credits_used: creditsCost,
//       remaining_credits: credits.balance - creditsCost,
//     }), {
//       status: 200,
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//     });
// 
//   } catch (error) {
//     console.error("ai-generate-content error:", error);
//     return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
//       status: 500,
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//     });
//   }
// });
