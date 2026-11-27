import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireberryClient } from '../../src';
import { FIELD_TYPE_IDS } from '../../src/constants/fieldTypes';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const json = (body: unknown, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });

// The fields list endpoint does not carry the lookup target (verified live 2026-11-27).
const contactFields = [
  { fieldName: 'contactid', label: 'Contact', systemFieldTypeId: FIELD_TYPE_IDS.TEXT, systemName: 'Contact' },
  { fieldName: 'accountid', label: 'Account', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, systemName: 'Contact' },
  { fieldName: 'ownerid', label: 'Owner', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, systemName: 'Contact' },
  { fieldName: 'deletedby', label: 'Deleted by', systemFieldTypeId: FIELD_TYPE_IDS.LOOKUP, systemName: 'Contact' },
];

const targets: Record<string, string> = { accountid: '1', ownerid: '9', deletedby: '9' };

/** Routes fetch by URL like the real API. `failing` field names answer HTTP 500. */
function routeFetch(failing: string[] = []) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.signal?.aborted) {
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    }
    const path = new URL(url).pathname;
    if (path === '/metadata/records/2/fields') {
      return json({ success: true, data: contactFields });
    }
    const single = path.match(/^\/metadata\/records\/2\/fields\/([^/]+)$/);
    if (single) {
      const name = single[1];
      if (failing.includes(name)) {
        return json({ Message: 'An internal error has occured' }, 500);
      }
      const field = contactFields.find((f) => f.fieldName === name);
      return json({ success: true, data: { ...field, fieldObjectType: targets[name] }, message: '' });
    }
    return json({ Message: `unexpected call ${path}` }, 400);
  });
}

const calledPaths = () => mockFetch.mock.calls.map(([url]) => new URL(url as string).pathname);

describe('MetadataAPI.getFields lookup relations', () => {
  let client: FireberryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new FireberryClient({ apiKey: 'test-key', retryOn429: false, cacheMetadata: true });
  });

  it('reads lookup targets from field metadata, not the legacy /api/query', async () => {
    routeFetch();
    const result = await client.metadata.getFields(2);

    const byName = Object.fromEntries(result.fields.map((f) => [f.fieldName, f.relatedObjectType]));
    expect(byName.accountid).toBe(1);
    expect(byName.ownerid).toBe(9);
    expect(byName.contactid).toBeUndefined();
    expect(calledPaths()).not.toContain('/api/query');
    expect(calledPaths()).toContain('/metadata/records/2/fields/accountid');
  });

  it('resolves deletedby, which the legacy query rejected', async () => {
    routeFetch();
    const result = await client.metadata.getFields(2);
    expect(result.fields.find((f) => f.fieldName === 'deletedby')?.relatedObjectType).toBe(9);
  });

  it('does not request metadata for non-lookup fields', async () => {
    routeFetch();
    await client.metadata.getFields(2);
    expect(calledPaths()).not.toContain('/metadata/records/2/fields/contactid');
  });

  it('keeps the other relations when one lookup read fails, and reports the failure', async () => {
    routeFetch(['ownerid']);
    const result = await client.metadata.getFields(2);

    const byName = Object.fromEntries(result.fields.map((f) => [f.fieldName, f.relatedObjectType]));
    expect(byName.accountid).toBe(1);
    expect(byName.deletedby).toBe(9);
    expect(byName.ownerid).toBeUndefined();
    expect(result.lookupRelationErrors).toEqual([
      expect.objectContaining({ fieldName: 'ownerid' }),
    ]);
  });

  it('does not cache a result with failed lookup reads', async () => {
    routeFetch(['ownerid']);
    await client.metadata.getFields(2);

    routeFetch();
    const second = await client.metadata.getFields(2);
    expect(second.fields.find((f) => f.fieldName === 'ownerid')?.relatedObjectType).toBe(9);
    expect(second.lookupRelationErrors).toBeUndefined();
  });

  it('caches a complete result', async () => {
    routeFetch();
    await client.metadata.getFields(2);
    const callsAfterFirst = mockFetch.mock.calls.length;
    await client.metadata.getFields(2);
    expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
  });

  it('skips lookup requests when includeLookupRelations is false', async () => {
    routeFetch();
    const result = await client.metadata.getFields(2, { includeLookupRelations: false });
    expect(calledPaths()).toEqual(['/metadata/records/2/fields']);
    expect(result.fields.every((f) => f.relatedObjectType === undefined)).toBe(true);
  });

  it('propagates cancellation instead of swallowing it', async () => {
    routeFetch();
    const controller = new AbortController();
    controller.abort();
    await expect(client.metadata.getFields(2, { signal: controller.signal })).rejects.toThrow();
  });
});
