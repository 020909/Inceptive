
const ai = require('ai');
console.log("AI EXPORTS:", Object.keys(ai));

const { streamText } = ai;
console.log("streamText EXPORTS:", typeof streamText);

// Mock a streamText call if possible to see result properties
try {
  const result = { toTextStreamResponse: 'fn', toDataStreamResponse: 'fn' }; // mock
  console.log("Mock Check:", !!result.toDataStreamResponse);
} catch (e) {}
