# Security
*Project: Telepath*

## Running This Project

This project uses the Anthropic API. To run it locally:

1. Copy `.env.example` to `.env`
2. Add your own `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com)
3. (Recommended) Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from a free [upstash.com](https://upstash.com) Redis database for full rate limiting behavior
4. Your secrets stay local — `.env` is in `.gitignore` and never committed

## Architecture

All Anthropic API calls are proxied through a Vercel Edge Function (`/api/ai.ts`). The API key is never exposed to the browser or included in the client bundle.

Current edge proxy controls:
- Origin allowlisting (`ALLOWED_ORIGINS`) for browser requests
- Model allowlisting (`ALLOWED_ANTHROPIC_MODELS`) to prevent arbitrary model selection
- Request-size, prompt-length, and max-token bounds
- Per-IP/per-origin rate limiting backed by Upstash Redis (persistent across edge isolates) with `Retry-After` response headers
- Sanitized upstream error messages (internal provider errors are not returned verbatim)

## Reporting Vulnerabilities

This is a personal portfolio project. If you spot a security issue, please open a GitHub Issue. For anything sensitive, contact via the profile email.

## No User Data

The MVP collects no user data and has no authentication. No PII is stored or transmitted.
