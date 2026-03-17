
const { streamText } = require('ai');
const model = {
  modelId: 'test',
  doGenerate: async () => ({ text: 'final', finishReason: 'stop' }),
  doStream: async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', textDelta: 'chunk' });
        controller.close();
      }
    }),
    rawCall: { rawPrompt: 't', rawResponse: 'r' }
  }),
  specificationVersion: 'v2'
};

const result = streamText({ model, prompt: 'test' });
const stream = result.fullStream;

(async () => {
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log("EVENT TYPE:", value.type);
    console.log("EVENT DATA:", JSON.stringify(value).substring(0, 50));
  }
})();
