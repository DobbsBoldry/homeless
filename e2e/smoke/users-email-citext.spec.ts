/**
 * S8 — users.email is case-insensitive (FND-003b / #192).
 *
 * Migration 0033 changes the column type to citext. Insert a row with
 * mixed-case email, query in all-lowercase, assert match. If the column
 * ever regresses to text, this test fails immediately.
 */

import { dbClient } from '../fixtures/db';
import { expect, test } from '../fixtures/test-base';

test.describe('S8 users.email citext', () => {
  test('mixed-case insert is found by lowercase WHERE', async () => {
    const sql = dbClient();
    try {
      const tag = `s8-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const mixed = `Mixed.Case.${tag}@Example.COM`;
      const lower = mixed.toLowerCase();

      const inserted = await sql`
        insert into users (clerk_user_id, email)
        values (${`clerk_${tag}`}, ${mixed})
        returning id, email
      `;
      const id = inserted[0]?.id;
      expect(id).toBeTruthy();

      // The whole point: query with a different casing than what was inserted.
      const found = await sql`
        select id from users where email = ${lower}
      `;
      expect(found.length, 'lowercase query did not match mixed-case insert').toBe(1);
      expect(found[0]?.id).toBe(id);

      // And confirm the column type itself, so a future migration that
      // accidentally reverts to text fails this test loudly.
      const colType = await sql`
        select data_type, udt_name from information_schema.columns
        where table_name = 'users' and column_name = 'email'
      `;
      expect(colType[0]?.udt_name).toBe('citext');

      await sql`delete from users where id = ${id}`;
    } finally {
      await sql.end({ timeout: 1 });
    }
  });
});
