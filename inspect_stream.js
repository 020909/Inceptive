
const { streamText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

// We need an API key to even call the constructor usually
const model = {
  modelId: 'test',
  doGenerate: async () => ({ text: 'hi', finishReason: 'stop' }),
  doStream: async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', textDelta: 'hi' });
        controller.close();
      }
    }),
    rawCall: { rawPrompt: 'test', rawResponse: 'test' }
  })
};

const result = streamText({
  model: model,
  prompt: 'test'
});

console.log("streamText Result Properties:", Object.keys(result));
console.log("Result Type:", typeof result);
if (result.then) {
  console.log("Result is a promise!");
}
