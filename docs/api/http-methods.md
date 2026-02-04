# HTTP Method Behavior

Comprehensive reference showing how different HTTP methods are handled in File-System mode.

## Overview Table

| Method | File Exists | Body Allowed | Files Allowed | Pagination | Filters | Behavior | Status Code |
|--------|-------------|--------------|---------------|------------|---------|----------|-------------|
| **GET** | ✅ Yes | ❌ No | ❌ No | ✅ Yes (JSON arrays) | ✅ Yes (JSON arrays) | Returns file content | 200 |
| **GET** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | Error | 404 |
| **HEAD** | ✅ Yes | ❌ No | ❌ No | ✅ Yes (JSON arrays) | ✅ Yes (JSON arrays) | Returns headers only | 200 |
| **POST** | ❌ No | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Creates new file | 201 |
| **POST** | ✅ Yes (JSON) | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | Returns filtered data | 200 |
| **POST** | ✅ Yes (non-JSON) | - | - | ❌ No | ❌ No | Error | 400 |
| **PUT** | ❌ No | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Creates file | 201 |
| **PUT** | ✅ Yes | ✅ Yes | ✅ Yes (single) | ❌ No | ❌ No | Replaces file | 200 |
| **PATCH** | ✅ Yes (JSON) | ✅ Yes (JSON) | ❌ No | ❌ No | ❌ No | Merges/patches file | 200 |
| **PATCH** | ❌ No | - | - | ❌ No | ❌ No | Error | 404 |
| **DELETE** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | Deletes file | 204 |
| **DELETE** | ✅ Yes (JSON) | ❌ No | ❌ No | ✅ Yes | ✅ Yes | Partial delete | 204 |
| **DELETE** | ❌ No | - | - | ❌ No | ❌ No | Error | 404 |
| **OPTIONS** | - | - | - | ❌ No | ❌ No | Error | 405 |

## GET Method

Returns file content. Supports pagination and filtering for JSON arrays.

### Success (File Exists)

```bash
GET /api/users
```

**Response:**
- Status: `200 OK`
- Headers: `Content-Type`, `Content-Length`, `X-Total-Elements`
- Body: File content

### With Pagination

```bash
GET /api/users?limit=10&skip=20&sortBy=name&order=desc
```

**Requirements:**
- ✅ File must be JSON array
- ✅ Pagination configured
- ❌ Request cannot have body

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "skip": 20,
    "limit": 10,
    "returned": 10
  }
}
```

### Error (File Not Found)

```bash
GET /api/nonexistent
```

**Response:**
- Status: `404 Not Found`

### Error (Body Not Allowed)

```bash
GET /api/users
Content-Type: application/json

{"filter": "active"}
```

**Response:**
- Status: `400 Bad Request`
- Error: "GET request cannot have a body in File System API mode"

## HEAD Method

Same as GET but returns only headers, no body.

```bash
HEAD /api/users
```

**Response:**
- Status: `200 OK`
- Headers: `Content-Type`, `Content-Length`, `X-Total-Elements`
- Body: (empty)

## POST Method

Complex behavior depending on file existence and request content.

### Create New File

```bash
POST /api/users/123
Content-Type: application/json

{"name": "John", "email": "john@example.com"}
```

**Response:**
- Status: `201 Created`
- File created at: `mock/users/123.json`

### File Upload (Single File)

```bash
POST /api/documents/report
Content-Type: multipart/form-data

(file data)
```

**Response:**
- Status: `201 Created`
- **Note:** Only FIRST file is written, others ignored

### Query Existing Data (With Pagination/Filters)

```bash
POST /api/users?status=active&limit=10
```

**Response:**
- Status: `200 OK`
- File is NOT modified
- Returns filtered/paginated data

### Error: File Exists (Without Pagination)

```bash
POST /api/users
Content-Type: application/json

{"name": "John"}
```

**Response:**
- Status: `409 Conflict`
- Error: "File at /api/users already exists"

### Error: Multiple Files

```bash
POST /api/upload
Content-Type: multipart/form-data

(multiple files)
```

**Response:**
- Status: `400 Bad Request`
- Error: "POST request with multiple file is not allowed"

### Error: Body + Files

```bash
POST /api/data
Content-Type: multipart/form-data

body: {"key": "value"}
file: (file data)
```

**Response:**
- Status: `400 Bad Request`
- Error: "POST request with file and body is not allowed"

### Error: Non-JSON File Exists

```bash
POST /api/image.png
(new data)
```

**Response:**
- Status: `400 Bad Request`
- Error: "POST request for not json file is not allowed"

## PUT Method

Replaces entire file content or creates new file.

### Create New File

```bash
PUT /api/users/456
Content-Type: application/json

{"name": "Jane", "email": "jane@example.com"}
```

**Response:**
- Status: `201 Created`

### Replace Existing File

```bash
PUT /api/users/123
Content-Type: application/json

{"name": "John Updated", "email": "john.new@example.com"}
```

**Response:**
- Status: `200 OK`
- File content completely replaced

### File Upload

```bash
PUT /api/documents/contract.pdf
Content-Type: application/pdf

(PDF binary data)
```

**Response:**
- Status: `200 OK` (if exists) or `201 Created`
- **Note:** Only FIRST file is written

### Error: No Data

```bash
PUT /api/users/123
(no body, no file)
```

**Response:**
- Status: `400 Bad Request`
- Error: "No data provided"

### Error: Multiple Files

```bash
PUT /api/data
Content-Type: multipart/form-data

(multiple files)
```

**Response:**
- Status: `400 Bad Request`
- Error: "PUT request with multiple file is not allowed"

## PATCH Method

Partially updates JSON files using merge or JSON Patch.

### Merge Patch (RFC 7396)

```bash
PATCH /api/users/123
Content-Type: application/json

{"email": "newemail@example.com"}
```

**Behavior:**
- Merges with existing JSON object
- Only specified fields updated
- Status: `200 OK`

### JSON Patch (RFC 6902)

```bash
PATCH /api/users/123
Content-Type: application/json-patch+json

[
  {"op": "replace", "path": "/email", "value": "new@example.com"},
  {"op": "add", "path": "/phone", "value": "555-1234"}
]
```

**Behavior:**
- Applies JSON Patch operations
- Status: `200 OK`

### Supported Content-Types

- `application/json` → Merge patch
- `application/merge-patch+json` → Merge patch
- `application/json-patch+json` → JSON Patch (RFC 6902)

### Error: File Not Found

```bash
PATCH /api/nonexistent
```

**Response:**
- Status: `404 Not Found`
- Error: "Resource to update not found"

### Error: Non-JSON File

```bash
PATCH /api/image.png
```

**Response:**
- Status: `400 Bad Request`
- Error: "Only json file can be processing with PATCH http method"

### Error: Unsupported Content-Type

```bash
PATCH /api/users/123
Content-Type: text/plain
```

**Response:**
- Status: `415 Unsupported Media Type`
- Error: "PATCH request content-type unsupported"

## DELETE Method

Deletes file or filtered items from JSON array.

### Delete Entire File

```bash
DELETE /api/users/123
```

**Response:**
- Status: `204 No Content`
- Headers: `X-Deleted-Elements: 1`
- File removed

### Partial Delete (With Filters)

```bash
DELETE /api/users?status=inactive
```

**Behavior:**
- Deletes matching items from JSON array
- If array becomes empty: deletes file
- If items remain: updates file
- Status: `204 No Content`
- Headers: `X-Deleted-Elements: N`

**Example:**

```json
// Before: mock/users.json
[
  {"id": 1, "status": "active"},
  {"id": 2, "status": "inactive"},
  {"id": 3, "status": "inactive"}
]

// Request: DELETE /api/users?status=inactive

// After: mock/users.json
[
  {"id": 1, "status": "active"}
]

// Response Headers: X-Deleted-Elements: 2
```

### Error: File Not Found

```bash
DELETE /api/nonexistent
```

**Response:**
- Status: `404 Not Found`
- Error: "Resource to delete not found"

### Error: Body Not Allowed

```bash
DELETE /api/users/123
Content-Type: application/json

{"confirm": true}
```

**Response:**
- Status: `400 Bad Request`
- Error: "DELETE request cannot have a body"

### Error: No Matches (With Filters)

```bash
DELETE /api/users?status=banned
```

**Response:**
- Status: `404 Not Found`
- Error: "Partial resource to delete not found"

## OPTIONS Method

Not supported in File-System mode.

```bash
OPTIONS /api/users
```

**Response:**
- Status: `405 Method Not Allowed`
- Error: "Method OPTIONS not allowed in File System API mode"

## Special Headers

### Response Headers

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | MIME type of response | `application/json` |
| `Content-Length` | Size in bytes | `1024` |
| `X-Total-Elements` | Total items (before pagination) | `150` |
| `X-Deleted-Elements` | Number of deleted items | `5` |

### Request Headers

| Header | Required For | Example |
|--------|--------------|---------|
| `Content-Type` | POST, PUT, PATCH | `application/json` |
| `Authorization` | (if middleware configured) | `Bearer token123` |

## File Lookup Strategy

When a request doesn't match a file exactly, the plugin tries:

1. **Exact match**: `/api/users` → `mock/users`
2. **Directory index**: `/api/users/` → `mock/users/index.json`
3. **With extension**: `/api/data` → `mock/data.json`, `mock/data.xml`, etc.

**Example:**

```
Request: GET /api/users

Lookup order:
1. mock/users (exact file)
2. mock/users/index.json (directory index)
3. mock/users.json (with .json extension)
4. mock/users.xml (with .xml extension)
...
```

## Pagination & Filters Scope

::: warning Requirements
Pagination and filters work ONLY when:
- ✅ File exists and contains JSON array
- ✅ Method is GET, POST, HEAD, or DELETE
- ✅ Configuration is set (globally or per-handler)
- ❌ Does NOT work with JSON objects or non-JSON files
:::

**Works:**
```json
[{"id": 1}, {"id": 2}]  // ✅ JSON array
```

**Does NOT work:**
```json
{"users": [{"id": 1}]}  // ❌ JSON object
```

## Content-Type Requirements

| Method | Required | Allowed Values |
|--------|----------|----------------|
| GET | No | (ignored) |
| HEAD | No | (ignored) |
| POST | Recommended | Any MIME type |
| PUT | Yes | Any MIME type |
| PATCH | Yes | `application/json`, `application/json-patch+json`, `application/merge-patch+json` |
| DELETE | No | (body not allowed) |

## Common Error Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Invalid body, multiple files, body in GET/DELETE |
| 404 | Not Found | File doesn't exist |
| 405 | Method Not Allowed | OPTIONS method |
| 409 | Conflict | File exists when creating |
| 415 | Unsupported Media Type | Wrong Content-Type for PATCH |
| 500 | Internal Server Error | File I/O errors |
