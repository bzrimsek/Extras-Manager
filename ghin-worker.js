const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

  try {
    const body = await request.json();
    const ghinNumbers = body.ghinNumbers;
    if (!ghinNumbers || !ghinNumbers.length) {
      return new Response(JSON.stringify({ error: 'No ghinNumbers provided' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Login
    const loginResp = await fetch('https://api.ghin.com/api/v1/golfer_login.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: { email_or_ghin: GHIN_USERNAME, password: GHIN_PASSWORD, remember_me: true },
        token: 'r54neurqjnde78d'
      })
    });
    const loginData = await loginResp.json();
    const token = loginData?.golfer_user?.golfer_user_token || loginData?.token;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Login failed: ' + JSON.stringify(loginData).slice(0,200) }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    // Fetch each golfer via search endpoint (same as @spicygolf/ghin package)
    const results = await Promise.all(ghinNumbers.map(async (ghinNum) => {
      try {
        const params = new URLSearchParams({
          golfer_id: String(ghinNum),
          page: '1',
          per_page: '1',
          status: 'Active',
          source: 'GHINcom'
        });
        const resp = await fetch('https://api.ghin.com/api/v1/golfers/search.json?' + params.toString(), {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await resp.json();
        const g = data?.golfers?.[0];
        if (!g) return { ghin: ghinNum, handicap_index: null, error: 'Not found' };
        return {
          ghin: ghinNum,
          handicap_index: g.hi_value != null ? g.hi_value : (g.handicap_index != null ? parseFloat(g.handicap_index) : null),
          hi_display: g.hi_display || null,
          first_name: g.first_name || null,
          last_name: g.last_name || null
        };
      } catch(e) {
        return { ghin: ghinNum, handicap_index: null, error: e.message };
      }
    }));

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch(err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}
