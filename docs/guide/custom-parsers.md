# Custom Parsers

The plugin includes a built-in request body parser that automatically
handles common content types such as JSON and URL-encoded data.

However, in advanced scenarios you may need to:

-   Integrate existing Express parsers
-   Support multipart file uploads
-   Apply custom body transformations
-   Add validation or sanitization layers
-   Support proprietary or non-standard formats

For these cases, the plugin allows full parser customization.

------------------------------------------------------------------------

## Default Parser Behavior

When the `parser` option is enabled (default behavior):

-   JSON bodies are automatically parsed
-   Query parameters are extracted
-   Uploaded files (multipart) are parsed if supported

``` ts
mockApi({
  endpointPrefix: '/api',
  parser: true
})
```

------------------------------------------------------------------------

## Disabling the Parser

You can disable parsing entirely:

``` ts
mockApi({
  endpointPrefix: '/api',
  parser: false
})
```

------------------------------------------------------------------------

## Custom Parser Configuration

``` ts
parser: {
  parser: ParserFunction | ParserFunction[],
  transform: (req: IncomingMessage) => ({
    body?: any
    files?: UploadedFile[]
    query?: URLSearchParams
  })
}
```

------------------------------------------------------------------------

## Example: Express Integration

``` ts
import express from 'express'
import multer from 'multer'

const upload = multer()

mockApi({
  endpointPrefix: '/api',
  parser: {
    parser: [
      express.json(),
      express.urlencoded({ extended: true }),
      upload.any()
    ],
    transform: (req: any) => ({
      body: req.body,
      files: req.files?.map((file: any) => ({
        name: file.originalname,
        content: file.buffer,
        contentType: file.mimetype
      })),
      query: new URLSearchParams(req.url.split('?')[1])
    })
  }
})
```

------------------------------------------------------------------------

## Best Practices

✔ Keep parser logic minimal\
✔ Validate input early\
✔ Avoid blocking operations\
✔ Use streaming for large data

## Next Steps

- [REST Handlers](/guide/rest-handlers) - Add custom logic
- [Pagination & Filters](/guide/pagination-filters) - Detailed configuration
- [HTTP Methods](/api/http-methods) - Complete reference
