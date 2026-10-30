// Writes src/lib/database.types.ts from Supabase-generated types and re-applies
// the one hand edit we keep: change_submission_status share arguments also take
// exact decimal strings (the app sends "12.5", never a float).
// Usage: node scripts/write-db-types.mjs <types.ts | supabase-mcp-output.json>
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync(process.argv[2], 'utf8')
let types = src.trimStart().startsWith('[') ? JSON.parse(JSON.parse(src)[0].text).types : src

const start = types.indexOf('change_submission_status: {')
const end = types.indexOf('Returns', start)
if (start < 0 || end < 0) throw new Error('change_submission_status not found in the generated types')
const args = types
  .slice(start, end)
  .replace(/p_signed_share_pct\?: number\n/, 'p_signed_share_pct?: number | string\n')
  .replace(/p_written_share_pct\?: number\n/, 'p_written_share_pct?: number | string\n')
if (!args.includes('p_signed_share_pct?: number | string') || !args.includes('p_written_share_pct?: number | string')) {
  throw new Error('Could not re-apply the share-argument typing')
}
types = types.slice(0, start) + args + types.slice(end)

const header =
  '// Generated from the Supabase schema (project mig-inward-re). Regenerate after each migration\n' +
  '// with scripts/write-db-types.mjs, which keeps the hand edit: numeric share arguments of\n' +
  '// change_submission_status also accept exact decimal strings.\n'
writeFileSync('src/lib/database.types.ts', header + (types.endsWith('\n') ? types : types + '\n'))
console.log('src/lib/database.types.ts written')
