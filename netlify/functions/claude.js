const https = require('https');

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Log everything for debugging
    console.log('Method:', event.httpMethod);
    console.log('Body received:', event.body);
    console.log('Key exists:', !!process.env.GROQ_API_KEY);
    console.log('Key prefix:', process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 8) : 'MISSING');

    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    const body = JSON.parse(raw);
    const prompt = body.prompt || '';

    console.log('Prompt length:', prompt.length);

    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No prompt' }) };
    }

    const postData = JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        console.log('Groq status:', res.statusCode);
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          console.log('Groq response:', data.substring(0, 200));
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
            if (text) resolve(text);
            else reject(new Error('No content: ' + data.substring(0, 100)));
          } catch(e) { reject(e); }
        });
      });

      req.on('error', (e) => {
        console.log('Request error:', e.message);
        reject(e);
      });
      req.write(postData);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify({ result }) };

  } catch (err) {
    console.log('Handler error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
