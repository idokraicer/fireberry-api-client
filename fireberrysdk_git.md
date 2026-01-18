Directory structure:
└── fireberry-crm-sdk/
    ├── README.md
    ├── eslint.config.js
    ├── LICENSE.md
    ├── package.json
    ├── tsconfig.cjs.json
    ├── tsconfig.json
    ├── .prettierrc.json
    ├── src/
    │   ├── fireberrySDK.client.ts
    │   ├── iframeMessageManager.ts
    │   ├── constants/
    │   │   └── index.ts
    │   ├── context/
    │   │   ├── context.ts
    │   │   └── index.ts
    │   └── types/
    │       └── index.ts
    └── .github/
        └── workflows/
            └── publish.yml


Files Content:

================================================
FILE: README.md
================================================
# Fireberry SDK

A lightweight TypeScript SDK for integrating with the Fireberry platform, providing seamless communication for embedded applications. Built with modern TypeScript and designed for optimal developer experience.

## Features

- **📝 Full CRUD Operations**: Create, Query (Read), Update, Delete operations for business objects
- **🔍 Advanced Querying**: Flexible querying with field selection, filtering, and pagination
- **⚡ TypeScript First**: Full type safety with comprehensive TypeScript definitions
- **🎯 Context Awareness**: Automatic context detection and management
- **🚀 Promise-based API**: Modern async/await support for all operations

## Installation

```bash
npm install @fireberry/sdk
```

## Quick Start

### Basic Usage

```typescript
import FireberryClientSDK from '@fireberry/sdk/client';

// Create a new instance
const client = new FireberryClientSDK();

// Initialize context
await client.initializeContext();

// Access the API through the api getter
const api = client.api;

// Get current context information (If not initialized first context will return null)
const context = client.context;
```

### CRUD Operations

```typescript
const objectType = 1;

// Query records with advanced filtering
const results = await api.query(objectType, {
  fields: 'id,name,createdOn,ownerName',
  query: 'name LIKE "test%" AND ownerName = "John"',
  page_size: 20,
  page_number: 1,
});

// Create a new record
const newRecord = await api.create(objectType, {
  name: 'New Business Record',
  description: 'Detailed description of the record',
  status: 'active',
});

// Update an existing record
const updatedRecord = await api.update(objectType, 'recordId123', {
  name: 'Updated Record Name',
  status: 'completed',
});

// Delete a record
const deleteRecord = await api.delete(objectType, 'recordId123');
```

## Browser Support

- Modern browsers with ES6+ support
- Iframe communication support required
- TypeScript 4.0+ for development

## License

MIT

## Maintainers

- **Johnny Marelly** (johnnym@fireberry.com) - Project maintenance and enhancements

## Support

For questions, issues, or contributions, please contact the maintainers or open an issue in the project repository.



================================================
FILE: eslint.config.js
================================================
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      // TypeScript ESLint recommended rules
      ...tseslint.configs.recommended.rules,

      // Your custom rules
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],

      // Prettier integration
      'prettier/prettier': 'error',
    },
  },

  // Prettier config to disable conflicting rules
  prettierConfig,

  // Ignore patterns
  {
    ignores: ['dist/', 'node_modules/', '**/*.js.map', '**/*.d.ts.map'],
  },
];



================================================
FILE: LICENSE.md
================================================
MIT License

Copyright (c) 2025 Fireberry LTD

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



================================================
FILE: package.json
================================================
{
  "name": "@fireberry/sdk",
  "version": "0.0.5",
  "description": "Fireberry SDK",
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "prepare": "npm run build",
    "format": "prettier --write \"src/**/*.ts\"",
    "lint": " tsc --noEmit && eslint \"src/**/*.ts\"",
    "build": "npm run clean && npm run build:esm && npm run build:cjs",
    "dev:cjs": "tsc -p tsconfig.cjs.json --watch",
    "dev:esm": "tsc -p tsconfig.json --watch",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:esm": "tsc -p tsconfig.json",
    "test": "jest --watchAll",
    "clean": "rm -rf dist"
  },
  "exports": {
    "./client": {
      "import": {
        "types": "./dist/esm/fireberrySDK.client.d.ts",
        "default": "./dist/esm/fireberrySDK.client.js"
      },
      "require": {
        "types": "./dist/cjs/fireberrySDK.client.d.ts",
        "default": "./dist/cjs/fireberrySDK.client.js"
      }
    }
  },
  "files": [
    "dist"
  ],
  "bundleDependencies": [],
  "repository": {
    "type": "git",
    "url": "https://github.com/fireberry-crm/sdk.git"
  },
  "maintainers": [
    {
      "name": "Johnny Marelly",
      "email": "johnnym@fireberry.com"
    }
  ],
  "contributors": [
    {
      "name": "Itay Zemah",
      "email": "itay@fireberry.com"
    },
    {
      "name": "Johnny Marelly",
      "email": "johnnym@fireberry.com"
    }
  ],
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.12.8",
    "@typescript-eslint/eslint-plugin": "^8.46.2",
    "@typescript-eslint/parser": "^8.46.2",
    "eslint": "^9.38.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.4",
    "globals": "^16.4.0",
    "prettier": "^3.2.5",
    "typescript": "^5.4.5"
  },
  "keywords": [
    "fireberry",
    "sdk"
  ]
}



================================================
FILE: tsconfig.cjs.json
================================================
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "module": "CommonJS",
        "outDir": "./dist/cjs",
        "target": "ES2017"
    }
}


================================================
FILE: tsconfig.json
================================================
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["ES2017", "DOM"],
    "module": "ESNext",
    "rootDir": "src",
    "outDir": "./dist/esm",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "removeComments": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "baseUrl": "./",
    "paths": {
      "*": ["*"]
    },
    "typeRoots": ["@types", "./node_modules/@types"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}



================================================
FILE: .prettierrc.json
================================================
{
    "printWidth": 100,
    "tabWidth": 2,
    "singleQuote": true,
    "jsxBracketSameLine": true,
    "trailingComma": "es5"
}



================================================
FILE: src/fireberrySDK.client.ts
================================================
import { MESSAGE_TYPES, REQUEST_ACTIONS } from './constants';
import { Context } from './context';
import { IframeMessageManager } from './iframeMessageManager';
import type {
  API,
  Payload,
  QueryPayload,
  RecordDetails,
  Response,
  ResponseData,
  ResponseError,
  UserDetails,
} from './types';

export class FireberryClientSDK<TData extends Response> extends IframeMessageManager<TData> {
  private _context: Context | null = null;
  constructor() {
    super();
  }

  get api(): API<TData> {
    return {
      query: this.query.bind(this),
      create: this.create.bind(this),
      delete: this.delete.bind(this),
      update: this.update.bind(this),
    };
  }

  get context(): Context | null {
    return this._context;
  }
  /**
   * @param this - see what `this` argument means here https://www.typescriptlang.org/docs/handbook/2/classes.html#this-parameters
   */
  async initializeContext<T extends TData>(
    this: FireberryClientSDK<T>
  ): Promise<FireberryClientSDK<T>> {
    if (this.context) {
      return this;
    }

    const response = await this.sendMessageWithPromise({
      type: MESSAGE_TYPES.REQUEST_CONTEXT,
    });

    const { status, data, statusText } = (response?.error as ResponseError) ?? {};

    if (status && status !== 200) {
      throw new Error(data?.Message ?? statusText);
    }

    const { recordId, objectType, userInfo } =
      (response.data as T & {
        recordId: RecordDetails['id'];
        objectType: RecordDetails['type'];
        userInfo: UserDetails;
      }) ?? {};

    this.setContext(
      new Context({
        record: { id: recordId, type: objectType },
        user: { fullName: userInfo.fullName, id: userInfo.id },
      })
    );

    return this;
  }

  private setContext(context: Context): void {
    this._context = context;
  }

  private query(objectType: string | number, payload: QueryPayload): Promise<ResponseData<TData>> {
    return this.sendMessageWithPromise({
      type: MESSAGE_TYPES.REQUEST,
      action: REQUEST_ACTIONS.QUERY,
      objecttype: objectType,
      ...payload,
    });
  }

  private create<T extends Payload>(
    objectType: string | number,
    payload: T
  ): Promise<ResponseData<TData>> {
    return this.sendMessageWithPromise({
      type: MESSAGE_TYPES.REQUEST,
      action: REQUEST_ACTIONS.CREATE,
      objectType,
      ...payload,
    });
  }

  private delete(objectType: string | number, recordId: string): Promise<ResponseData<TData>> {
    return this.sendMessageWithPromise({
      type: MESSAGE_TYPES.REQUEST,
      action: REQUEST_ACTIONS.DELETE,
      objectType,
      recordId,
    });
  }

  private update<T extends Payload>(
    objectType: string | number,
    recordId: string,
    payload: T
  ): Promise<ResponseData<TData>> {
    return this.sendMessageWithPromise({
      type: MESSAGE_TYPES.REQUEST,
      action: REQUEST_ACTIONS.UPDATE,
      objectType,
      recordId,
      ...payload,
    });
  }
}

export type {
  BusinessObject,
  Data,
  Payload,
  QueryPayload,
  ResponseData,
  ResponseError,
} from './types';

export default FireberryClientSDK;



================================================
FILE: src/iframeMessageManager.ts
================================================
import { MESSAGE_TYPES, TIMEOUT_DURATION } from './constants';
import { MessagePayload, Response, ResponseData } from './types';

export class IframeMessageManager<TData extends Response> {
  private requestIdCounter: number = 0;
  private pendingRequests: Map<
    string,
    {
      resolve: (value: ResponseData<TData>) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reject: (reason: any) => void;
    }
  > = new Map();

  constructor() {
    this.listen();
  }

  private listen(): this {
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener('message', this.handleMessage);

    return this;
  }

  private sendMessage(payload: MessagePayload): void {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  }

  protected sendMessageWithPromise(payload: MessagePayload): Promise<ResponseData<TData>> {
    const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

    return new Promise<ResponseData<TData>>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      const payloadWithId = {
        ...payload,
        requestId,
      };

      this.sendMessage(payloadWithId);

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout: No response received'));
        }
      }, TIMEOUT_DURATION);
    });
  }

  private handleMessage(event: MessageEvent<ResponseData<TData>>): void {
    const { data: payload } = event;

    if (!payload || typeof payload !== 'object' || !payload.type) {
      return;
    }

    const { type, requestId } = payload;

    const handlePendingRequest = (
      requestId: string,
      callback?: (payload: ResponseData<TData>) => void
    ) => {
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve } = this.pendingRequests.get(requestId)!;
        this.pendingRequests.delete(requestId);
        resolve(payload);
      }
      if (callback) {
        callback(payload);
      }
    };

    // Keep this switch case for further extensions
    switch (type) {
      case MESSAGE_TYPES.RESPONSE:
        handlePendingRequest(requestId);
        break;
      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  public destroy(): void {
    window.removeEventListener('message', this.handleMessage);

    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('SDK destroyed'));
    });

    this.pendingRequests.clear();
  }
}



================================================
FILE: src/constants/index.ts
================================================
export const MESSAGE_TYPES = {
  RESPONSE: 'RESPONSE',
  REQUEST: 'REQUEST',
  REQUEST_CONTEXT: 'REQUEST_CONTEXT',
} as const;

export const REQUEST_ACTIONS = {
  CREATE: 'CREATE',
  DELETE: 'DELETE',
  UPDATE: 'UPDATE',
  QUERY: 'QUERY',
} as const;

export const TIMEOUT_DURATION = 60000; // one minute;



================================================
FILE: src/context/context.ts
================================================
import { ContextDetails, RecordDetails, UserDetails } from '../types';

export class Context {
  public user: UserDetails;
  public record: RecordDetails;

  constructor(context: ContextDetails) {
    this.user = context.user;
    this.record = context.record;
  }
}



================================================
FILE: src/context/index.ts
================================================
export * from './context';



================================================
FILE: src/types/index.ts
================================================
import { MESSAGE_TYPES, REQUEST_ACTIONS } from '../constants';
import { Context } from '../context';

export type Response = Partial<BusinessObject> & Partial<Context>;
export type Data = Partial<BusinessObject> & { requestId?: string };
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
export type RequestAction = (typeof REQUEST_ACTIONS)[keyof typeof REQUEST_ACTIONS];

export type MessagePayload = Record<string, unknown> & {
  type: MessageType;
} & Partial<RequestPayload>;
export type Payload = Record<string, unknown>;

export type ResponseError = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> & { Message?: string };
  status: number;
  statusText: string;
};

export type RecordDetails = Partial<{
  type: number;
  id: string;
}>;

export type UserDetails = Partial<{
  fullName: string;
  id: string;
}>;

export type ContextDetails = {
  record: RecordDetails;
  user: UserDetails;
};

export type RequestPayload = {
  action: RequestAction;
  objectType?: string | number;
  recordId?: string;
};

export type BusinessObject = {
  createdBy: string;
  createdByName: string;
  createdOn: Date;
  ownerId: string;
  ownerName: string;
  modifiedBy: string;
  modifiedByName: string;
  modifiedOn: Date;
};

export type ResponseData<T extends Response> = {
  type?: MessageType;
  success: boolean;
  data: T & Data;
  error?: ResponseError;
  isParentReady: boolean;
  requestId: string;
};

export type QueryPayload = {
  fields: string;
  query: string;
  page_size?: number;
  page_number?: number;
};

export interface API<TData extends Response> {
  query: (objectType: string | number, payload: QueryPayload) => Promise<ResponseData<TData>>;
  create: <T extends Payload>(
    objectType: string | number,
    payload: T
  ) => Promise<ResponseData<TData>>;
  delete: (objectType: string | number, recordId: string) => Promise<ResponseData<TData>>;
  update: <T extends Payload>(
    objectType: string | number,
    recordId: string,
    payload: T
  ) => Promise<ResponseData<TData>>;
}



================================================
FILE: .github/workflows/publish.yml
================================================
name: Publish Fireberry SDK to npm

on:
  workflow_dispatch:

# Prevent concurrent releases
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Build & Lint SDK
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      id-token: write
      attestations: write

    outputs:
      version: ${{ steps.info.outputs.version }}
      name: ${{ steps.info.outputs.name }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: "https://registry.npmjs.org/"
          cache: "npm"
          cache-dependency-path: ${{ github.workspace }}/package-lock.json

      - name: Get package info
        id: info
        run: |
          echo "name=$(node -p "require('./package.json').name")" >> $GITHUB_OUTPUT
          NEW_VERSION=$(node -p "require('./package.json').version")
          echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Build SDK
        run: npm run build

      - name: Generate build attestation
        uses: actions/attest-build-provenance@v3
        with:
          subject-path: "dist/**/*"

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: sdk-dist
          path: dist/
          retention-days: 1
          compression-level: 6

  publish:
    name: Publish to npm
    needs: build
    runs-on: ubuntu-22.04
    permissions:
      contents: read
      id-token: write
      attestations: write

    environment:
      name: npm
      url: https://www.npmjs.com/package/${{ needs.build.outputs.name }}/v/${{ needs.build.outputs.version }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: "https://registry.npmjs.org/"

      - name: Download build artifacts
        uses: actions/download-artifact@v5
        with:
          name: sdk-dist
          path: .

      - name: Generate package attestation
        uses: actions/attest-build-provenance@v3
        with:
          subject-path: "package.json"

      - name: Update npm
        run: npm install -g npm@latest

      - name: Publish to npm
        run: npm publish --provenance --access public

  release:
    name: Create GitHub Release
    needs: [build, publish]
    runs-on: ubuntu-22.04
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v5

      - name: Create GitHub release
        run: |
          gh release create "v${{ needs.build.outputs.version }}" --verify-tag \
            --title "Release v${{ needs.build.outputs.version }}" \
            --generate-notes \
            --latest
        env:
          GH_TOKEN: ${{ github.token }}


