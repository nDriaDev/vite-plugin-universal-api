# Pattern Matching

The plugin uses Ant-style path matching to route REST and WebSocket
requests.

------------------------------------------------------------------------

## Exact Match

    /api/users

------------------------------------------------------------------------

## Single Segment Wildcard

    /api/*

Matches exactly one segment.

------------------------------------------------------------------------

## Multi Segment Wildcard

    /api/**

Matches multiple segments.

------------------------------------------------------------------------

## Path Parameters

    /api/users/{id}

``` ts
req.params.id
```

------------------------------------------------------------------------

## Multiple Parameters

    /api/users/{userId}/posts/{postId}

------------------------------------------------------------------------

## Best Practices

✔ Prefer explicit patterns\
✔ Place specific handlers first\
✔ Avoid overly generic wildcards

## Next Steps

- [REST Handlers](/guide/rest-handlers) - Add custom logic
- [Pagination & Filters](/guide/pagination-filters) - Detailed configuration
- [HTTP Methods](/api/http-methods) - Complete reference
