import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {createClient} from "npm:@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}


async function getEmployee(supabaseClient: SupabaseClient, id: string) {
  const { data: person, error: personError } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

    if (personError) {
      return new Response(
    JSON.stringify({ error: 'Employee not found' }),
    { 
      headers: {...corsHeaders, "Content-Type": "application/json" },
      status: 404
     },
  )
    };

    const { data: reports, error: reportsError } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('parent_id', id);

    if (reportsError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching reports' }),
        { 
          headers: { ...corsHeaders,"Content-Type": "application/json" },
          status: 500
         },
      )
    };
  
   return new Response(
    JSON.stringify({ person, reports }),
    { headers: {...corsHeaders, "Content-Type": "application/json" } },
  )
}
async function getCEO(supabaseClient: SupabaseClient) {
  const { data: ceo, error: ceoError } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('level', 0)
        .single();

    if (ceoError) {
      return new Response(
    JSON.stringify({ error: 'CEO not found' }),
    { 
      headers: {...corsHeaders, "Content-Type": "application/json" },
      status: 404
     },
  )
    };

    const { data: reports, error: reportsError } = await supabaseClient
        .from('employees')
        .select('*')
        .eq('parent_id', ceo.id);

    if (reportsError) {
      return new Response(
        JSON.stringify({ error: 'Error fetching reports' }),
        { 
          headers: { ...corsHeaders,"Content-Type": "application/json" },
          status: 500
         },
      )
    };
  
   return new Response(
    JSON.stringify({ ceo, reports }),
    { headers: {...corsHeaders, "Content-Type": "application/json" } },
  )
}

Deno.serve(async (req) => {
  const { url, method } = req
  
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const supabaseClient = createClient(
       // Supabase API URL - env var exported by default.
       Deno.env.get('SUPABASE_URL') ?? '',
       // Supabase API ANON KEY - env var exported by default.
       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
       // Create client with Auth context of the user that called the function.
       // This way your row-level-security (RLS) policies are applied.
       {
         global: {
           headers: { Authorization: req.headers.get('Authorization')! },
         },
       }
    );

    const employeePattern = new URLPattern({ pathname: '/fetchEmployees/:id' })
    const matchingPath = employeePattern.exec(url)
    const id = matchingPath ? matchingPath.pathname.groups.id : null

    let employee = null
    if (method === 'POST' || method === 'PUT') {
      const body = await req.json()
      employee = body.employee
    }
    
    switch (true) {
      case id && method === 'GET':
        return getEmployee(supabaseClient, id as string)
      default:
        return getCEO(supabaseClient)
    }

} catch (error) {
    console.error("Error in fetchNodes function:", error);

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
}
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/fetchEmployees' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
