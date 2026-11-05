// Supabase Edge Function: payment-request
// Deployment required. Environment: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// Authentication: Authorization Bearer access token; never trust a user_id from JSON.
// This endpoint only creates a PENDING request; it NEVER activates a subscription.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const auth=req.headers.get("Authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(auth))return json({error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!secret)return json({error:"server_not_configured"},503);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await userClient.auth.getUser();
  if(authError||!user)return json({error:"unauthorized"},401);
  let input:unknown;
  try{input=await req.json()}catch{return json({error:"invalid_json"},400)}
  if(!input||typeof input!=="object")return json({error:"invalid_body"},400);
  const body=input as Record<string,unknown>;
  if(typeof body.plan_id!=="string"||!/^[a-z0-9_-]{1,40}$/.test(body.plan_id))return json({error:"invalid_plan"},400);
  const payerNote=typeof body.payer_note==="string"?body.payer_note.trim():"";
  const transferRef=typeof body.transfer_reference==="string"?body.transfer_reference.trim():null;
  if(payerNote.length>1000||(transferRef&&transferRef.length>150))return json({error:"invalid_fields"},400);
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const {data:plan,error:planError}=await admin.from("ruwad_plans").select("id,price_lyd,active").eq("id",body.plan_id).eq("active",true).maybeSingle();
  if(planError)return json({error:"server_error"},500);
  if(!plan)return json({error:"plan_not_available"},404);
  // A small anti-spam cap; enforce stronger rate limits at the edge gateway in production.
  const {count,error:countError}=await admin.from("ruwad_payment_requests").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("status","pending");
  if(countError)return json({error:"server_error"},500);
  if((count||0)>=3)return json({error:"too_many_pending_requests"},429);
  const {data:payment,error:insertError}=await admin.from("ruwad_payment_requests").insert({
    user_id:user.id,plan_id:plan.id,amount_lyd:plan.price_lyd,
    payer_note:payerNote,transfer_reference:transferRef,status:"pending"
  }).select("id,reference,amount_lyd,status,submitted_at").single();
  if(insertError)return json({error:"request_failed"},500);
  return json({payment,message:"طلب الاشتراك بانتظار التحقق من وصول التحويل. لا يتم التفعيل تلقائيًا."},201);
});
