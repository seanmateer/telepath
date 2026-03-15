import {
  buildAllowedOrigins,
  createCorsHeaders,
  isOriginAllowed,
  isProductionEnvironment,
  parseJsonPayload,
} from '../aiSecurity.js';
import {
  RoomServiceError,
  applyRoomAction,
  parseRoomActionRequest,
} from './service.js';
import type { RoomPublicState } from '../../src/types/room.js';

type ErrorResponse = {
  ok: false;
  error: string;
  code?: string;
  room?: RoomPublicState;
};

const createJsonResponse = (
  body: ErrorResponse | Awaited<ReturnType<typeof applyRoomAction>>,
  status: number,
  corsHeaders: Record<string, string>,
): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
  });
};

const createErrorResponse = (
  error: RoomServiceError | Error,
  corsHeaders: Record<string, string>,
): Response => {
  if (error instanceof RoomServiceError) {
    return createJsonResponse(
      {
        ok: false,
        error: error.message,
        code: error.code,
        room: error.room,
      },
      error.status,
      corsHeaders,
    );
  }

  return createJsonResponse(
    { ok: false, error: 'Room action failed.' },
    500,
    corsHeaders,
  );
};

export default async function handler(req: Request): Promise<Response> {
  const originHeader = req.headers.get('origin');
  const allowMissingOrigin = !isProductionEnvironment();
  const allowedOrigins = buildAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    req.headers.get('host'),
    { includeLocalDevOrigins: !isProductionEnvironment() },
  );
  const corsHeaders = createCorsHeaders(originHeader, allowedOrigins);

  if (!isOriginAllowed(originHeader, allowedOrigins, { allowMissingOrigin })) {
    return createJsonResponse(
      { ok: false, error: 'Origin not allowed.' },
      403,
      corsHeaders,
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return createJsonResponse(
      { ok: false, error: 'Method not allowed. Use POST.' },
      405,
      corsHeaders,
    );
  }

  const rawBody = await req.text();
  const body = parseJsonPayload(rawBody);
  if (!body) {
    return createJsonResponse(
      { ok: false, error: 'Invalid JSON payload.' },
      400,
      corsHeaders,
    );
  }

  const parsedRequest = parseRoomActionRequest(body);
  if (!parsedRequest.ok) {
    return createJsonResponse(
      { ok: false, error: parsedRequest.error },
      400,
      corsHeaders,
    );
  }

  try {
    const response = await applyRoomAction(parsedRequest.data);
    return createJsonResponse(response, 200, corsHeaders);
  } catch (error: unknown) {
    return createErrorResponse(
      error instanceof Error ? error : new Error('Unknown room action failure'),
      corsHeaders,
    );
  }
}
