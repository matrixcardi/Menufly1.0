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
// const RUNWAY_API_URL = "https://api.dev.runwayml.com/v1";
// const RUNWAY_VERSION = "2024-11-06";
// 
// // ── FOOD MARKETING VIDEO ENGINE ──
// // Especializada 100% em restaurantes. Cada prompt gera DESEJO através de movimento.
// // Técnicas: food porn cinematography, neuromarketing sensorial, gatilhos de apetite.
// 
// const CAMERA_MOVEMENTS: Record<string, string[]> = {
//   "16:9": [
//     "slow cinematic dolly push-in from medium to extreme close-up, revealing every texture detail",
//     "smooth lateral tracking shot slowly revealing the dish plating from left to right like a commercial reveal",
//     "gentle crane-down from overhead establishing shot descending to eye-level hero angle",
//     "slow arc orbiting 45 degrees around the dish, catching the light at different angles",
//   ],
//   "9:16": [
//     "slow vertical tilt-up from the base of the plate revealing layers of ingredients up to the garnish on top",
//     "smooth push-in from medium shot to extreme close-up on the most appetizing detail",
//     "gentle descending shot from above, slowly approaching the dish like you're about to take a bite",
//     "subtle parallax push-in with the background separating from the sharp foreground food",
//   ],
//   "1:1": [
//     "slow 360-degree orbit around the dish, showcasing every angle and catching dynamic light reflections",
//     "smooth push-in with rack focus from background element to the hero dish in sharp focus",
//     "gentle overhead descent circling slightly, creating a hypnotic food reveal",
//   ],
//   "4:5": [
//     "slow push-in centered on the hero element — the melting cheese, the dripping sauce, the perfect crust",
//     "gentle arc movement revealing the dish's depth and layers from a 30-degree angle",
//     "smooth tilt-down from garnish to base, revealing the full composition like unwrapping a gift",
//   ],
// };
// 
// // Actions that trigger appetite and FOMO — the viewer must FEEL the food
// const FOOD_DESIRE_ACTIONS = [
//   "thick steam rising slowly from the hot surface, curling and dissolving into the air",
//   "rich, velvety sauce being slowly drizzled over the dish, pooling perfectly around the edges",
//   "melted cheese stretching in a long, satisfying pull as a slice is lifted",
//   "a golden-crispy crust being cracked open, revealing the juicy, steaming interior",
//   "fresh herbs gently falling onto the dish like confetti, adding the final touch of perfection",
//   "condensation droplets slowly running down an ice-cold glass next to the dish",
//   "a knife cutting through the dish in slow motion, juices flowing out dramatically",
//   "a light sprinkle of flaky sea salt crystals tumbling through the air onto the dish",
//   "bubbling, caramelized cheese surface with golden-brown spots pulsing with heat",
//   "a fork piercing the dish and slowly lifting a perfect bite, trailing strings of melted goodness",
// ];
// 
// // Lighting designed to make food look its absolute best — ALWAYS with animated bokeh background
// const VIDEO_LIGHTING_STYLES = [
//   "warm golden backlight creating a glowing halo around rising steam, soft amber fill light revealing every texture. Background: beautifully blurred with warm golden and amber bokeh orbs gently drifting and pulsing, creating a dreamy restaurant ambiance",
//   "dramatic single key light from 45 degrees with warm amber gel, deep cinematic shadows creating depth, subtle rim light separating food from dark background. Background: rich out-of-focus bokeh lights in warm orange and gold tones slowly shifting and floating, evoking a cozy evening atmosphere",
//   "soft wraparound lighting with warm tones simulating golden hour, gentle highlights on moist surfaces making them glisten. Background: ethereal bokeh circles in champagne and honey tones gently moving and breathing, creating a luxurious dining feel",
//   "low-key moody lighting with a focused warm spot on the dish, surrounding darkness creating a spotlight effect. Background: scattered warm bokeh orbs of varying sizes slowly dancing in the deep darkness, like distant candlelights in an upscale restaurant",
// ];
// 
// // Animated background styles — the signature look for all product videos
// const ANIMATED_BACKGROUND_INSTRUCTIONS = [
//   "The background must be beautifully out of focus with large, soft, circular bokeh lights in warm golden and amber tones. These bokeh orbs should gently drift, pulse, and float throughout the entire video, creating a mesmerizing animated backdrop that makes the sharp foreground food pop dramatically.",
//   "Background is deeply blurred with dreamy bokeh circles in warm tones (gold, amber, soft orange). The bokeh lights slowly animate — drifting laterally, gently pulsing in brightness, and floating like fireflies. This creates a premium restaurant atmosphere behind the razor-sharp food in the foreground.",
//   "Extreme shallow depth of field isolates the food in tack-sharp focus while the background dissolves into a sea of large, luminous bokeh orbs. These background lights must visibly animate — slowly moving, shifting in size, and breathing with gentle intensity changes throughout the clip.",
// ];
// 
// function getRandomItem<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }
// 
// async function optimizePromptWithAI(
//   userPrompt: string,
//   productName: string,
//   productDescription: string | null,
//   aspectRatio: string,
//   maxLen: number
// ): Promise<string> {
//   const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
//   if (!LOVABLE_API_KEY) {
//     console.warn("LOVABLE_API_KEY not available, skipping AI prompt optimization");
//     return "";
//   }
// 
//   const systemPrompt = `You are an expert prompt engineer for Runway ML's image-to-video AI, specialized in food marketing videos.
// 
// CRITICAL — RUNWAY'S HARD LIMITATIONS:
// - Runway takes ONE STILL IMAGE and adds SUBTLE MOTION to it (5-10 seconds)
// - It CANNOT generate: people, hands, eating, biting, holding, human faces, human bodies, scene cuts, multiple angles, narrative sequences, "at the end show X"
// - It CANNOT change what's in the image — it can only ANIMATE what's already there
// - It CAN do: camera movements (dolly, pan, tilt, orbit, push-in), atmospheric effects (steam rising, smoke, light shifts, sparkles), food physics (sauce dripping, cheese melting, bubbles forming, condensation), depth-of-field shifts, subtle color/light changes
// 
// TRANSLATION EXAMPLES:
// - "cliente comendo o lanche" → "Slow cinematic push-in towards the burger, steam gently rising from the hot patty, warm golden backlight creating an appetizing glow"
// - "vários takes e ângulos diferentes" → "Smooth 45-degree orbit around the dish, revealing textures and layers from different perspectives as light catches the surfaces"
// - "no final mostra os ingredientes" → "Gentle rack focus shift from the assembled dish to reveal the crispy layers, melted cheese, and fresh toppings in sharp detail"
// - "pessoa mordendo com vontade" → "Extreme close-up of the burger with cheese slowly melting and dripping down the side, steam curling upward, making the viewer crave a bite"
// - "cliente na hamburgueria" → "The dish sits on a dark restaurant table, warm ambient bokeh lights gently shifting in the background, creating an inviting atmosphere"
// 
// SIGNATURE STYLE — ANIMATED BOKEH BACKGROUND (MANDATORY):
// Every single video MUST have a beautifully blurred background with large, soft, circular bokeh lights in warm golden/amber tones. These bokeh orbs MUST visibly animate throughout the video — gently drifting, pulsing in brightness, floating like distant candlelights. This is our signature look. The food stays in razor-sharp focus while the background is a dreamy, living canvas of moving light.
// 
// YOUR TASK:
// 1. COMPLETELY IGNORE any requests for people, hands, eating, or human actions
// 2. Extract the user's CORE visual intent (what mood/feeling they want)
// 3. Translate it into what Runway does BEST: camera motion + food physics + atmospheric effects
// 4. ALWAYS include the animated bokeh background as the signature style
// 5. Write in English, be very specific about movement direction and speed
// 6. Keep it under ${maxLen} characters
// 7. The result should make the food look absolutely irresistible
// 
// OUTPUT FORMAT: Write ONLY the optimized prompt, no explanations or commentary.
// 
// ALWAYS include:
// - One specific camera movement with direction and speed
// - One food-specific animation (steam, drip, melt, sizzle, condensation)
// - Lighting description with color temperature
// - ANIMATED BOKEH BACKGROUND: large warm bokeh orbs gently drifting and pulsing in the blurred background
// - "Photorealistic, cinematic food commercial quality. Extreme shallow depth of field. No text, no watermarks, no humans, no hands."`;
// 
// 
//   const userMessage = `Product: "${productName}"${productDescription ? ` (${productDescription})` : ""}
// Aspect ratio: ${aspectRatio}
// User's request: "${userPrompt}"
// 
// Rewrite this as an optimized single-shot Runway prompt:`;
// 
//   try {
//     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${LOVABLE_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "google/gemini-2.5-flash",
//         messages: [
//           { role: "system", content: systemPrompt },
//           { role: "user", content: userMessage },
//         ],
//         max_tokens: 500,
//         temperature: 0.7,
//       }),
//     });
// 
//     if (!response.ok) {
//       console.error("AI prompt optimization failed:", response.status);
//       return "";
//     }
// 
//     const data = await response.json();
//     const optimized = data.choices?.[0]?.message?.content?.trim();
//     if (optimized && optimized.length > 20) {
//       console.log("AI-optimized prompt:", optimized);
//       return optimized.slice(0, maxLen);
//     }
//   } catch (e) {
//     console.error("AI prompt optimization error:", e);
//   }
//   return "";
// }
// 
// async function buildVideoPrompt(
//   productName: string,
//   productDescription: string | null,
//   restaurantName: string,
//   aspectRatio: string,
//   customPrompt: string,
//   isGen4: boolean
// ): Promise<string> {
//   const maxLen = isGen4 ? 1000 : 512;
// 
//   // If user provided a custom prompt, use AI to optimize it for Runway
//   if (customPrompt && customPrompt.length > 15) {
//     const aiOptimized = await optimizePromptWithAI(
//       customPrompt, productName, productDescription, aspectRatio, maxLen
//     );
//     if (aiOptimized) {
//       return aiOptimized;
//     }
//     // Fallback: enhance manually
//     const camera = getRandomItem(CAMERA_MOVEMENTS[aspectRatio] || CAMERA_MOVEMENTS["16:9"]);
//     const lighting = getRandomItem(VIDEO_LIGHTING_STYLES);
//     return [
//       customPrompt,
//       `Camera: ${camera}.`,
//       `Lighting: ${lighting}.`,
//       "The food must look absolutely mouthwatering and trigger immediate craving.",
//       "Photorealistic, professional food commercial quality. No text, no logos, no watermarks.",
//     ].join(" ").slice(0, maxLen);
//   }
// 
//   // Build a rich automatic prompt optimized for food desire + animated bokeh background
//   const camera = getRandomItem(CAMERA_MOVEMENTS[aspectRatio] || CAMERA_MOVEMENTS["16:9"]);
//   const action = getRandomItem(FOOD_DESIRE_ACTIONS);
//   const lighting = getRandomItem(VIDEO_LIGHTING_STYLES);
//   const bgStyle = getRandomItem(ANIMATED_BACKGROUND_INSTRUCTIONS);
// 
//   const descriptionContext = productDescription
//     ? `The dish consists of: ${productDescription.slice(0, 150)}.`
//     : "";
// 
//   const parts = [
//     `Hyper-realistic cinematic food commercial of "${productName}" — the kind of video that makes viewers immediately crave this dish.`,
//     descriptionContext,
//     `Camera: ${camera}.`,
//     `Hero action: ${action}.`,
//     `Lighting: ${lighting}.`,
//     `ANIMATED BACKGROUND: ${bgStyle}`,
//     "The food is in tack-sharp focus while the entire background is a gorgeous blur of animated warm bokeh lights that gently drift and pulse throughout the video.",
//     "Every surface glistens with freshness. Colors are warm, vibrant, and saturated — emphasizing golden browns, rich reds, and fresh greens.",
//     "Style: premium food commercial shot on ARRI Alexa with Cooke anamorphic lens, extreme shallow depth of field with creamy circular bokeh, subtle film grain, cinematic warm color grading.",
//     "Ultra high quality, photorealistic, Super Bowl commercial grade. No text, no logos, no watermarks, no human hands.",
//   ];
// 
//   return parts.filter(Boolean).join(" ").slice(0, maxLen);
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
//     const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
//     if (!RUNWAY_API_KEY) throw new Error("RUNWAY_API_KEY is not configured");
// 
//     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
//     const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// 
//     // Auth check
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
//     const { action, ...body } = await req.json();
// 
//     // ── ACTION: start ── Create a video generation task
//     if (action === "start") {
//       const { restaurant_id, product_id, image_url, prompt, aspect_ratio, video_model, duration: requestedDuration } = body;
// 
//       // Validate restaurant access (owner, collaborator, or master)
//       const { data: restaurant } = await adminClient
//         .from("restaurants")
//         .select("id, name, user_id")
//         .eq("id", restaurant_id)
//         .single();
// 
//       if (!restaurant) {
//         return new Response(JSON.stringify({ error: "Restaurante não encontrado" }), {
//           status: 403,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       const isOwner = restaurant.user_id === user.id;
//       const { data: collabLink } = await adminClient
//         .from("restaurant_collaborators")
//         .select("id")
//         .eq("restaurant_id", restaurant_id)
//         .eq("user_id", user.id)
//         .maybeSingle();
//       const { data: masterRole } = await adminClient
//         .from("user_roles")
//         .select("id")
//         .eq("user_id", user.id)
//         .eq("role", "master")
//         .maybeSingle();
// 
//       if (!isOwner && !collabLink && !masterRole) {
//         return new Response(JSON.stringify({ error: "Sem permissão para este restaurante" }), {
//           status: 403,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       // Check credits (video costs 3)
//       // Gen-4.5 upgrade: map user selection to actual Runway model IDs
//       const selectedModel = video_model === "gen4_turbo" ? "gen4_turbo" : "gen3a_turbo";
//       const creditsCost = selectedModel === "gen4_turbo" ? 5 : 3;
//       const { data: credits } = await adminClient
//         .from("ai_credits")
//         .select("balance")
//         .eq("restaurant_id", restaurant_id)
//         .single();
// 
//       if (!credits || credits.balance < creditsCost) {
//         return new Response(JSON.stringify({ error: "Créditos insuficientes" }), {
//           status: 402,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       // Get product info
//       let productName = "item";
//       let productDescription: string | null = null;
//       if (product_id) {
//         const { data: product } = await adminClient
//           .from("products")
//           .select("name, description")
//           .eq("id", product_id)
//           .single();
//         if (product) {
//           productName = product.name;
//           productDescription = product.description;
//         }
//       }
// 
//       const isGen4 = true; // Always use Gen-4+ prompt optimization
//       const videoPrompt = await buildVideoPrompt(
//         productName,
//         productDescription,
//         restaurant.name,
//         aspect_ratio || "16:9",
//         prompt || "",
//         isGen4
//       );
//       console.log("Generated video prompt:", videoPrompt);
// 
//       if (!image_url) {
//         return new Response(JSON.stringify({ error: "Imagem de referência é obrigatória para gerar vídeo." }), {
//           status: 400,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       // Build model-specific request body — always use gen4_turbo (Gen-4.5)
//       const runwayBody: Record<string, unknown> = {
//         model: "gen4_turbo",
//         promptImage: image_url,
//         promptText: videoPrompt,
//         duration: Math.min(10, Math.max(5, requestedDuration || 10)),
//       };
// 
//       // Valid Runway ratios: 1280:720, 720:1280, 1104:832, 832:1104, 960:960, 1584:672
//       const ratioMap: Record<string, string> = {
//         "16:9": "1280:720",
//         "9:16": "720:1280",
//         "1:1": "960:960",
//         "4:5": "832:1104",
//       };
//       runwayBody.ratio = ratioMap[aspect_ratio] || "1280:720";
// 
//       const runwayResp = await fetch(`${RUNWAY_API_URL}/image_to_video`, {
//         method: "POST",
//         headers: {
//           "Authorization": `Bearer ${RUNWAY_API_KEY}`,
//           "Content-Type": "application/json",
//           "X-Runway-Version": RUNWAY_VERSION,
//         },
//         body: JSON.stringify(runwayBody),
//       });
// 
//       if (!runwayResp.ok) {
//         const errText = await runwayResp.text();
//         console.error("Runway API error:", runwayResp.status, errText);
// 
//         if (runwayResp.status === 429) {
//           return new Response(JSON.stringify({ error: "Limite de requisições do Runway excedido. Tente novamente em alguns minutos." }), {
//             status: 429,
//             headers: { ...corsHeaders, "Content-Type": "application/json" },
//           });
//         }
//         if (runwayResp.status === 401 || runwayResp.status === 403) {
//           return new Response(JSON.stringify({ error: "Chave da API do Runway inválida ou sem permissão." }), {
//             status: 403,
//             headers: { ...corsHeaders, "Content-Type": "application/json" },
//           });
//         }
// 
//         return new Response(JSON.stringify({ error: "Erro ao iniciar geração de vídeo. Tente novamente." }), {
//           status: 500,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       const runwayData = await runwayResp.json();
//       const taskId = runwayData.id;
// 
//       // Create generation record
//       const { data: generation, error: genError } = await adminClient
//         .from("ai_generations")
//         .insert({
//           restaurant_id,
//           product_id: product_id || null,
//           generation_type: "product_video",
//           prompt: videoPrompt.slice(0, 500),
//           credits_used: creditsCost,
//           status: "processing",
//           result_url: JSON.stringify({ runway_task_id: taskId }),
//         })
//         .select()
//         .single();
// 
//       if (genError) throw genError;
// 
//       // Deduct credits
//       await adminClient.from("ai_credits").update({
//         balance: credits.balance - creditsCost,
//         total_used: (await adminClient.from("ai_credits").select("total_used").eq("restaurant_id", restaurant_id).single()).data!.total_used + creditsCost,
//       }).eq("restaurant_id", restaurant_id);
// 
//       // Record transaction
//       await adminClient.from("ai_credit_transactions").insert({
//         restaurant_id,
//         amount: -creditsCost,
//         type: "usage",
//         description: `Vídeo: ${productName}`,
//         generation_type: "product_video",
//       });
// 
//       return new Response(JSON.stringify({
//         success: true,
//         generation_id: generation.id,
//         runway_task_id: taskId,
//         credits_used: creditsCost,
//         remaining_credits: credits.balance - creditsCost,
//       }), {
//         status: 200,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     // ── ACTION: poll ── Check task status and download result
//     if (action === "poll") {
//       const { runway_task_id, generation_id, restaurant_id } = body;
// 
//       // Validate ownership
//       const { data: restaurant } = await adminClient
//         .from("restaurants")
//         .select("id")
//         .eq("id", restaurant_id)
//         .eq("user_id", user.id)
//         .single();
// 
//       if (!restaurant) {
//         return new Response(JSON.stringify({ error: "Não autorizado" }), {
//           status: 403,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       // Poll Runway task status
//       const statusResp = await fetch(`${RUNWAY_API_URL}/tasks/${runway_task_id}`, {
//         headers: {
//           "Authorization": `Bearer ${RUNWAY_API_KEY}`,
//           "X-Runway-Version": RUNWAY_VERSION,
//         },
//       });
// 
//       if (!statusResp.ok) {
//         const errText = await statusResp.text();
//         console.error("Runway poll error:", statusResp.status, errText);
//         return new Response(JSON.stringify({ status: "error", error: "Erro ao consultar status do vídeo." }), {
//           status: 500,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       const statusData = await statusResp.json();
//       console.log("Runway task status:", statusData.status);
// 
//       if (statusData.status === "SUCCEEDED") {
//         // Video is ready - get the output URL
//         const videoOutputUrl = statusData.output?.[0] || null;
// 
//         if (videoOutputUrl) {
//           // Download the video and upload to our storage
//           const videoResp = await fetch(videoOutputUrl);
//           const videoBlob = await videoResp.arrayBuffer();
//           const videoBytes = new Uint8Array(videoBlob);
// 
//           const fileName = `ai-generated/${restaurant_id}/${generation_id}.mp4`;
//           const { error: uploadError } = await adminClient.storage
//             .from("product-images")
//             .upload(fileName, videoBytes, { contentType: "video/mp4", upsert: true });
// 
//           if (uploadError) {
//             console.error("Upload error:", uploadError);
//             throw uploadError;
//           }
// 
//           const { data: { publicUrl } } = adminClient.storage.from("product-images").getPublicUrl(fileName);
// 
//           // Update generation record
//           await adminClient.from("ai_generations").update({
//             result_url: publicUrl,
//             status: "completed",
//           }).eq("id", generation_id);
// 
//           return new Response(JSON.stringify({
//             status: "completed",
//             result_url: publicUrl,
//           }), {
//             status: 200,
//             headers: { ...corsHeaders, "Content-Type": "application/json" },
//           });
//         }
//       }
// 
//       if (statusData.status === "FAILED") {
//         await adminClient.from("ai_generations").update({
//           status: "failed",
//         }).eq("id", generation_id);
// 
//         return new Response(JSON.stringify({
//           status: "failed",
//           error: statusData.failure || "Falha na geração do vídeo.",
//         }), {
//           status: 200,
//           headers: { ...corsHeaders, "Content-Type": "application/json" },
//         });
//       }
// 
//       // Still processing
//       return new Response(JSON.stringify({
//         status: "processing",
//         progress: statusData.progress || 0,
//       }), {
//         status: 200,
//         headers: { ...corsHeaders, "Content-Type": "application/json" },
//       });
//     }
// 
//     return new Response(JSON.stringify({ error: "Ação inválida" }), {
//       status: 400,
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     console.error("generate-video error:", error);
//     return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
//       status: 500,
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//     });
//   }
// });
