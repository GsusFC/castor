# Typefully API Notes

Official docs: https://typefully.com/docs/api

Use this file as a working checklist, and confirm exact endpoint paths/fields against the official docs when implementing a call.

## Auth

- Header: `Authorization: Bearer <TYPEFULLY_API_KEY>`
- Content type: `application/json`

## Operational Pattern

1. Build endpoint URL from documented base + route.
2. Send request with explicit method and JSON body.
3. Check HTTP code.
4. Parse JSON; confirm expected fields (`id`, state/status, timestamps).
5. For writes, immediately fetch the resource once when possible to verify final state.

## Safe Request Template

```bash
./skills/typefully-api/scripts/typefully_request.sh \
  --method POST \
  --path "/<endpoint>" \
  --data '{"key":"value"}'
```

## Validation Checklist

- Is the API key present?
- Is method correct (`GET/POST/PATCH/DELETE`)?
- Is payload valid JSON?
- Did API return 2xx?
- Did response include expected identifiers/state?

## Error Handling

- For non-2xx, print:
  - status code
  - response body
  - endpoint + method used
- Do not mark operation successful on partial/ambiguous responses.
