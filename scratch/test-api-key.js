const https = require('https');

const apiKey = 'AIzaSyB0bFvjx8gSOeGpXIPiRQ4fKbDVvrPdCSM';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      if (parsed.error) {
         console.log('ERROR:', parsed.error.message);
      } else {
         console.log('MODELS COUNT:', parsed.models ? parsed.models.length : 0);
         if (parsed.models) {
             const names = parsed.models.map(m => m.name);
             console.log('MODEL NAMES:', names.filter(n => n.includes('gemini')));
         }
      }
    } catch (e) {
      console.log('PARSE ERROR', e.message);
      console.log('RAW DATA:', data);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
