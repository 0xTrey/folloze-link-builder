/**
 * db.ts — Neon session persistence
 *
 * Stores generated link batches with a 24-hour TTL.
 * Customers can return to their session URL within 24h to re-download.
 *
 * Schema:
 *   link_sessions (
 *     id          UUID PK
 *     created_at  TIMESTAMPTZ
 *     expires_at  TIMESTAMPTZ  (created_at + 24h)
 *     row_count   INTEGER
 *     csv_data    TEXT         -- full output CSV as string
 *     config      JSONB        -- { boardUrl, utmSource, utmMedium, utmCampaign, utmContent }
 *   )
 *
 * Cleanup: expired rows are filtered on read. No active deletion in MVP.
 */

import { neon } from "@neondatabase/serverless";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export interface SessionConfig {
  boardUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
}

export interface SessionRecord {
  id: string;
  createdAt: string;
  expiresAt: string;
  rowCount: number;
  csvData: string;
  config: SessionConfig;
}

export async function createSession(
  rowCount: number,
  csvData: string,
  config: SessionConfig
): Promise<string> {
  const sql = getDb();
  const result = await sql`
    INSERT INTO link_sessions (row_count, csv_data, config)
    VALUES (${rowCount}, ${csvData}, ${JSON.stringify(config)})
    RETURNING id
  `;
  return result[0].id as string;
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const sql = getDb();
  const result = await sql`
    SELECT id, created_at, expires_at, row_count, csv_data, config
    FROM link_sessions
    WHERE id = ${id}
      AND expires_at > NOW()
  `;
  if (result.length === 0) return null;
  const row = result[0];
  return {
    id:         row.id as string,
    createdAt:  row.created_at as string,
    expiresAt:  row.expires_at as string,
    rowCount:   row.row_count as number,
    csvData:    row.csv_data as string,
    config:     row.config as SessionConfig,
  };
}
