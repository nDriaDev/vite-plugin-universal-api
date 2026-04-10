# REST Handlers — API Reference

## `UniversalApiRestHandler`

The union type for a single REST handler entry in the `handlers` array.

```typescript
type UniversalApiRestHandler =
  | UniversalApiRestFunctionHandler
  | UniversalApiRestFsHandler
```

---

## `UniversalApiRestFunctionHandler`

A handler that executes custom logic and writes the response manually.

```typescript
interface UniversalApiRestFunctionHandler {
  pattern:      string
  method:       HttpMethod
  handle:       UniversalApiSimpleHandler
  disabled?:    boolean
  delay?:       number
  parser?:      UniversalApiParser
  authenticate?: UniversalApiAuthenticate
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `pattern` | `string` | ✅ | Ant-style path pattern (e.g. `/users/{id}`, `/files/**`) |
| `method` | `HttpMethod` | ✅ | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` |
| `handle` | `UniversalApiSimpleHandler` | ✅ | Async function `(req, res) => Promise<void>`. Must write the response. |
| `disabled` | `boolean` | — | If `true`, the handler is skipped. Default: `false` |
| `delay` | `number` | — | Artificial delay in ms before executing the handler. Overrides the global `delay`. |
| `parser` | `UniversalApiParser` | — | Request parser configuration for this handler. Overrides the global `parser`. |
| `authenticate` | `UniversalApiAuthenticate` | — | Authentication check run before the handler. `true` requires the `authorization` header; a string requires that specific header; a function is a custom predicate. Default: `false` (no check). |

> **Note:** `pagination` and `filters` are **not** available on function handlers — they only apply to FS handlers. Implement pagination and filtering manually inside your `handle` function if needed.

---

## `UniversalApiRestFsHandler`

A handler that delegates request processing to the File-System API, with optional URL transformation (`preHandle`) or manual response control (`postHandle`).

```typescript
interface UniversalApiRestFsHandler {
  pattern:      string
  method:       HttpMethod
  handle:       'FS'
  disabled?:    boolean
  delay?:       number
  parser?:      UniversalApiParser
  authenticate?: UniversalApiAuthenticate
  pagination?:  'none' | { inclusive?: UniversalApiPagination; exclusive?: never } | { inclusive?: never; exclusive?: UniversalApiPagination }
  filters?:     'none' | { inclusive?: UniversalApiFilter; exclusive?: never } | { inclusive?: never; exclusive?: UniversalApiFilter }
  preHandle?:   UniversalApiPreHandle
  postHandle?:  UniversalApiPostHandle
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `pattern` | `string` | ✅ | Ant-style path pattern |
| `method` | `HttpMethod` | ✅ | HTTP method |
| `handle` | `'FS'` | ✅ | Literal string `'FS'` — delegates to File-System routing |
| `disabled` | `boolean` | — | If `true`, the handler is skipped. Default: `false` |
| `delay` | `number` | — | Artificial delay in ms. Overrides the global `delay`. |
| `parser` | `UniversalApiParser` | — | Request parser for this handler. Overrides the global `parser`. |
| `authenticate` | `UniversalApiAuthenticate` | — | Authentication check run before the handler. `true` requires the `authorization` header; a string requires that specific header; a function is a custom predicate. Default: `false` (no check). |
| `pagination` | `'none' \| { inclusive?: UniversalApiPagination } \| { exclusive?: UniversalApiPagination }` | — | Pagination config. `'none'` disables the global pagination. `inclusive` merges with the global config; `exclusive` replaces it entirely. Not available when `postHandle` is set. |
| `filters` | `'none' \| { inclusive?: UniversalApiFilter } \| { exclusive?: UniversalApiFilter }` | — | Filter config. `'none'` disables the global filters. `inclusive` merges with the global config; `exclusive` replaces it entirely. Not available when `postHandle` is set. |
| `preHandle` | `UniversalApiPreHandle` | — | URL transformation applied before the file lookup. |
| `postHandle` | `UniversalApiPostHandle` | — | Callback invoked after the file lookup, receiving the file content. Bypasses all automatic processing. |

---

## `UniversalApiPreHandle`

Transforms the request URL before the file lookup.

```typescript
interface UniversalApiPreHandle {
  transform: UniversalApiPreHandleTransform | UniversalApiPreHandleTransform[]
}

type UniversalApiPreHandleTransform =
  | ((url: string) => string)
  | { searchValue: string; replaceValue: string }
```

When `transform` is an array, each replacement is applied in order to the same URL string. `searchValue` is a plain string and replaces only the **first** occurrence (matching `String.prototype.replace` semantics).

---

## `UniversalApiPostHandle`

Called after the file lookup, regardless of the HTTP method. Receives the current file content as a string or `null` if no file was found.

```typescript
type UniversalApiPostHandle = (
  req:  UniversalApiRequest<any>,
  res:  ServerResponse,
  data: string | null
) => Promise<void> | void
```

| Parameter | Description |
|-----------|-------------|
| `req` | The incoming request with parsed `body`, `params`, `query`, and `files` |
| `res` | The Node.js `ServerResponse`. Must be used to write and end the response. |
| `data` | The file content as a UTF-8 string, or `null` if the file was not found on disk. JSON files are returned as their raw JSON string. Non-JSON files (images, text, binary, etc.) are also returned as a UTF-8 string read from disk. For non-`GET` methods, this is the **pre-existing** file content *before* any write or delete would have occurred. |

> ⚠️ When `postHandle` is defined, the plugin does **not** perform any automatic file write, delete, pagination, or filtering. The handler is fully responsible for the response and, if needed, any file I/O.

---

## `UniversalApiAuthenticate`

Authentication option accepted by both REST and WebSocket handlers.

```typescript
type UniversalApiAuthenticate =
  | false
  | true
  | string
  | ((request: IncomingMessage) => boolean | Promise<boolean>)
```

| Value | Behaviour |
|-------|-----------|
| `false` | No check — every request is allowed through. **Default.** |
| `true` | The `authorization` header must be present and non-empty. |
| `string` | The named header (case-insensitive) must be present and non-empty. |
| `function` | Custom predicate receiving the `IncomingMessage`. Return `true` to allow, `false` to reject. Supports `async`. |

A rejected request receives **`401 Unauthorized`**.
If the function throws, the response is **`500 Internal Server Error`**.

---

## `UniversalApiSimpleHandler`

```typescript
type UniversalApiSimpleHandler<TBody = unknown> = (
  req: UniversalApiRequest<TBody>,
  res: ServerResponse
) => Promise<void> | void
```

---

## `UniversalApiRequest<TBody>`

Extends Node.js `IncomingMessage` with parsed fields populated after the request parser runs.

```typescript
interface UniversalApiRequest<TBody = unknown> extends IncomingMessage {
  body:   TBody | null
  files:  UploadedFile[] | null
  params: Record<string, string> | null
  query:  URLSearchParams
}
```

| Field | Description |
|-------|-------------|
| `body` | Parsed request body. Type depends on `Content-Type`: JSON → object, `text/*` → string, `application/x-www-form-urlencoded` → `Record<string, string>`, `multipart/form-data` (non-file fields) → `Record<string, any>`. `null` if no body was sent. |
| `files` | Array of uploaded files from `multipart/form-data`. `null` if no files were uploaded. |
| `params` | Path parameters extracted from the pattern (e.g. `{ id: "123" }` from `/users/{id}`). `null` if the pattern has no parameters. |
| `query` | Parsed query string as `URLSearchParams`. Empty if no query string is present. |

---

## `UploadedFile`

```typescript
interface UploadedFile {
  name:        string
  content:     Buffer<ArrayBuffer>
  contentType: string
}
```

> **Note:** The TypeScript model declares `content` as `Buffer<ArrayBuffer>`. However, the built-in parser may resolve the actual runtime value to a plain `string` (for `text/*` parts) or a parsed `object` (for `application/json` parts) inside `multipart/form-data` requests. Always check the runtime value before assuming the type, especially when using the built-in parser without a custom `transform`.

---

## `HttpMethod`

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
```

---

## File Lookup Algorithm

When `handle: 'FS'` is used (with or without `preHandle`), the plugin resolves the file to serve with the following steps:

1. Strip the `endpointPrefix` from the request path to obtain the relative path.
2. Resolve the absolute path by joining `fsDir` with the relative path.
3. **Exact file match** — if a file exists at that path, serve it.
4. **Directory index** — if a directory exists at that path, look for `index.json` inside it and serve it if found.
5. **Extension resolution** — if neither a file nor a directory exists, list the parent directory and serve the first file whose name starts with the last path segment.
6. If none of the above match, respond with `404`.

> Only JSON files are eligible for pagination and filtering. Non-JSON files (images, text, XML, etc.) are served as-is for `GET`/`HEAD` requests via a streaming response.

---

## Handler Resolution Order

For each incoming request, the plugin iterates over the `handlers` array in declaration order and uses the **first** entry where all of the following are true:

- The `pattern` matches the request path (after prefix removal).
- The `method` matches the request HTTP method.
- `disabled` is not `true`.

If no handler matches, the request falls through to the bare File-System API (if `fsDir` is configured). If that also produces no match, the plugin responds with `404` or forwards to `next()` depending on the `noHandledRestFsRequestsAction` option.

---

For more details, see [REST Handlers Guide](/guide/rest-handlers).

## See Also

- [REST Handlers Guide](/guide/rest-handlers) — in-depth usage and examples
