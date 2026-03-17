
const events = [
  { type: 'text-delta', textDelta: 'Searching' },
  { type: 'tool-call', toolName: 'searchWeb', args: { query: 'news' }, toolCallId: '1' },
  { type: 'tool-result', toolName: 'searchWeb', toolCallId: '1', result: 'Success' },
  { type: 'text-delta', textDelta: ' Done.' }
];

function encode(event) {
  if (event.type === 'text-delta') {
    return `0:${JSON.stringify(event.textDelta)}\n`;
  }
  if (event.type === 'tool-call') {
    return `1:${JSON.stringify(event)}\n`;
  }
  if (event.type === 'tool-result') {
    return `2:${JSON.stringify(event)}\n`;
  }
  return '';
}

for (const e of events) {
  console.log("ENCODED:", encode(e).trim());
}
