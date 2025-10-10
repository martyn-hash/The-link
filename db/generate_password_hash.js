// Generate bcrypt hash for password
import bcrypt from 'bcrypt';

const password = 'TestPassword123';
const saltRounds = 12;

const hash = await bcrypt.hash(password, saltRounds);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nVerify existing hash:');

const existingHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2LhQY9Tfaa';
const isValid = await bcrypt.compare(password, existingHash);
console.log('Existing hash valid:', isValid);

console.log('\nSQL Update Command:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'georgewandhe@gmail.com';`);
