import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { email, password, full_name, role, commissariat_id } = await req.json();

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name, role, commissariat_id },
    email_confirm: true
  });

  if (authError) return new Response(JSON.stringify({ error: authError.message }), { status: 400 });

  const badge_number = `MAT-${user.user.id.substring(0, 6).toUpperCase()}`;

  await supabaseAdmin.from("profiles").upsert({
    id: user.user.id,
    email,
    full_name,
    role,
    commissariat_id,
    badge_number
  });

  return new Response(JSON.stringify({ success: true, user: user.user }), { status: 200 });
});