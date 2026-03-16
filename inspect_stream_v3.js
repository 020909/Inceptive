
const { streamText } = require('ai');
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
  }),
  specificationVersion: 'v2'
};

const result = streamText({
  model: model,
  prompt: 'test'
});

console.log("toTextStreamResponse exists:", typeof result.toTextStreamResponse);
console.log("toDataStreamResponse exists:", typeof result.toDataStreamResponse);
