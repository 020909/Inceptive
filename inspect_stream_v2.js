
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
  specificationVersion: 'v2' // Add this to see if it fixes the version error
};

try {
  const result = streamText({
    model: model,
    prompt: 'test'
  });
  console.log("streamText Result Keys:", Object.keys(result));
  console.log("textStream exists:", !!result.textStream);
  console.log("fullStream exists:", !!result.fullStream);
} catch (e) {
  console.log("Error during call:", e.message);
}
