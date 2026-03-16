
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

try {
  const result = streamText({
    model: model,
    prompt: 'test',
    maxSteps: 5 // Test if this causes a runtime error
  });
  console.log("Runtime maxSteps OK");
} catch (e) {
  console.log("Runtime maxSteps FAILED:", e.message);
}
