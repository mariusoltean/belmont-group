// Prints an ADMIN_PASSWORD_HASH line for .env. The password is read from stdin
// (not argv, so it does not end up in shell history or `ps`).
//   printf '%s' 'the-password' | npm run -s admin:hash
import { hashPassword } from './lib/auth.ts';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const password = input.replace(/\r?\n$/, '');
  if (password.length < 10) {
    console.error('Password must be at least 10 characters.');
    process.exit(1);
  }
  console.log(`ADMIN_PASSWORD_HASH='${hashPassword(password)}'`);
});
