/**
 * URL Builder — Folloze Link Builder
 *
 * Constructs tracked Folloze board URLs from contact data + UTM config.
 * Ported from assign_push.py:_build_board_url() in folloze-outbound-engine.
 *
 * Param schema:
 *   em  = contact email
 *   fn  = first name
 *   ln  = last name
 *   co  = company
 *   ro  = role / title
 *   inby = sender email (optional — omitted when blank)
 *   utm_source, utm_medium, utm_campaign, utm_content
 *
 * Rules:
 *   - Empty values are omitted to keep URLs clean.
 *   - Uses URLSearchParams which produces raw & (not &amp;).
 *     ESPs read href via regex, not HTML parser — &amp; would break redirects.
 *
 * Data flow:
 *   ContactRow + UtmConfig + boardUrl
 *       │
 *       ▼
 *   filter empty params
 *       │
 *       ▼
 *   URLSearchParams.toString()  →  raw & separator
 *       │
 *       ▼
 *   "{boardUrl}?{queryString}"
 */

export interface ContactRow {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  sender_email?: string;
}

export interface UtmConfig {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

export function buildFollozeUrl(
  boardUrl: string,
  contact: ContactRow,
  utms: UtmConfig
): string {
  const raw: Record<string, string> = {
    co:           contact.company      ?? "",
    em:           contact.email        ?? "",
    fn:           contact.first_name   ?? "",
    ln:           contact.last_name    ?? "",
    ro:           contact.title        ?? "",
    inby:         contact.sender_email ?? "",
    utm_source:   utms.utm_source,
    utm_medium:   utms.utm_medium,
    utm_campaign: utms.utm_campaign,
    utm_content:  utms.utm_content,
  };

  // Omit blank values — keeps URLs clean and matches Python assign_push behavior
  const filtered = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v.trim() !== "")
  );

  const qs = new URLSearchParams(filtered).toString();
  return `${boardUrl.replace(/\/$/, "")}?${qs}`;
}

/**
 * Appends a folloze_link column to each row object.
 * Rows missing a required email are skipped (returned as null).
 */
export function buildLinksForRows(
  boardUrl: string,
  contacts: ContactRow[],
  utms: UtmConfig
): Array<{ contact: ContactRow; link: string | null }> {
  return contacts.map((contact) => {
    if (!contact.email?.trim()) return { contact, link: null };
    return { contact, link: buildFollozeUrl(boardUrl, contact, utms) };
  });
}
