package main

import (
    "net/http"
    "strings"
)

// Sensitive headers to redact from snapshots
var sensitiveHeaders = map[string]bool{
    "authorization":  true,
    "cookie":         true,
    "set-cookie":     true,
    "x-api-key":      true,
    "x-auth-token":   true,
    "proxy-authorization": true,
}

func redactHeaders(h http.Header) map[string]string {
    result := make(map[string]string, len(h))
    for k, vals := range h {
        lower := strings.ToLower(k)
        if sensitiveHeaders[lower] {
            result[k] = "[REDACTED]"
        } else if len(vals) > 0 {
            result[k] = vals[0]
        }
    }
    return result
}
