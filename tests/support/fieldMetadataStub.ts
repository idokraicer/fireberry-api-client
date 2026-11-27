/**
 * Wraps a fetch mock so single-field metadata requests
 * (GET /metadata/records/{objectType}/fields/{fieldName}) are answered from fixtures,
 * and every other request falls through to the wrapped mock unchanged.
 *
 * getFields reads each lookup field's target from that endpoint, so tests that queue
 * sequential responses for the objects and fields lists use this to keep their order.
 */
type FixtureField = { fieldName: string; relatedObjectType?: number };

export function withFieldMetadata(
  fetchMock: (url: string, init?: RequestInit) => unknown,
  fixtures: FixtureField[][],
): (url: string, init?: RequestInit) => unknown {
  const targets = new Map<string, number>();
  for (const fields of fixtures) {
    for (const field of fields) {
      if (field.relatedObjectType !== undefined) {
        targets.set(field.fieldName, field.relatedObjectType);
      }
    }
  }

  return (url: string, init?: RequestInit) => {
    const match = new URL(url).pathname.match(/^\/metadata\/records\/[^/]+\/fields\/([^/]+)$/);
    if (!match) {
      return fetchMock(url, init);
    }
    const fieldName = decodeURIComponent(match[1]);
    const target = targets.get(fieldName);
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          success: true,
          data: { fieldName, fieldObjectType: target === undefined ? null : String(target) },
          message: '',
        }),
    });
  };
}
