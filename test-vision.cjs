const fs = require('fs');
require('dotenv').config();

async function test() {
  const apiKey = process.env.VITE_GROQ_API_KEY;
  if (!apiKey) { console.log('no key'); return; }
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' } }
          ]
        }
      ],
      max_tokens: 100,
    }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
