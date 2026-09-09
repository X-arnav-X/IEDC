const { getStore, connectLambda } = require('@netlify/blobs');

// Only these two keys are ever read/written by the client, so we don't
// expose an arbitrary key-value store to the public internet.
const ALLOWED_KEYS = new Set(['iedc-topic-counts', 'iedc-topic-total', 'iedc-draws-log']);

exports.handler = async (event) => {
  // This function uses the classic Lambda-compatible handler signature,
  // so Netlify Blobs isn't auto-configured — connectLambda() wires it up
  // manually using this invocation's event. Must run before getStore().
  connectLambda(event);

  const key = event.queryStringParameters && event.queryStringParameters.key;

  if (!key || !ALLOWED_KEYS.has(key)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'unknown key' }) };
  }

  let store;
  try {
    store = getStore('pitch-perfect');
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'blob store init failed: ' + e.message }) };
  }

  try {
    if (event.httpMethod === 'GET') {
      const value = await store.get(key, { type: 'json' });
      return { statusCode: 200, body: JSON.stringify({ value: value ?? null }) };
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'invalid json' }) };
      }
      if (payload.value === undefined) {
        return { statusCode: 400, body: JSON.stringify({ error: 'value required' }) };
      }
      await store.setJSON(key, payload.value);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: 'blob store error: ' + e.message }) };
  }

  return {
    statusCode: 405,
    headers: { Allow: 'GET, POST' },
    body: JSON.stringify({ error: 'method not allowed' })
  };
};
