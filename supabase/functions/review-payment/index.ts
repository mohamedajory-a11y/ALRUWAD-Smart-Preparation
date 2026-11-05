// Admin-only verification endpoint. Never approve from an uploaded receipt alone.
// Required: verified Supabase JWT and ADMIN_USER_IDS env (comma-separated auth user UUIDs).
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.4";
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const auth=req.headers.get("Authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(auth))return json({error:"unauthorized"},401);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!secret)return json({error:"not_configured"},503);
 const client=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data:{user}}=await client.auth.getUser();
 if(!user)return json({error:"unauthorized"},401);
 const admins=(Deno.env.get("ADMIN_USER_IDS")||"").split(",").map(x=>x.trim()).filter(Boolean);
 if(!admins.includes(user.id))return json({error:"forbidden"},403);
 let body:Record<string,unknown>;try{body=await req.json()}catch{return json({error:"invalid_json"},400)}
 if(typeof body.request_id!=="string"||! /^[0-9a-f-]{36}$/i.test(body.request_id))return json({error:"invalid_request_id"},400);
 if(body.action!=="approve"&&body.action!=="reject")return json({error:"invalid_action"},400);
 if(typeof body.confirmation_note!=="string"||body.confirmation_note.trim().length<10||body.confirmation_note.length>1000)return json({error:"confirmation_note_required"},400);
 if(body.action==="approve"&&body.bank_verified!==true)return json({error:"bank_verification_required"},400);
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 // The RPC function is defined in 002_review_payment.sql and performs all changes atomically.
 const {data,error}=await admin.rpc("ruwad_review_payment",{
   p_request_id:body.request_id,p_actor_id:user.id,p_action:body.action,
   p_note:body.confirmation_note.trim()
 });
 if(error)return json({error:"review_failed",detail:"Request could not be reviewed"},409);
 return json({result:data});
});
