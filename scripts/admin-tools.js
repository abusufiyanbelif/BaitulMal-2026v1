#!/usr/bin/env node
/**
 * BaitulMal Admin Toolkit — admin-tools.js
 * =========================================
 * A unified, interactive CLI for Firebase Admin operations.
 * Replaces all static one-off scripts (reset_admin_pwd.js, reset_passwords.js,
 * print_abusufiyan.js, scan_users.js, etc.)
 *
 * Usage:
 *   node scripts/admin-tools.js <command> [options]
 *
 * Commands:
 *   reset-password            Reset a Firebase Auth password (prompts for email + password)
 *   reset-password --email <email> --password <pwd>   Non-interactive mode
 *   reset-admins              Reset all sovereign admin accounts interactively
 *   print-user <uid|email>    Print full Firestore profile for a user
 *   scan-users                List all users + user_lookups
 *   scan-lookups              List user_lookups only
 *   add-lookup                Add/update a user_lookup entry
 *   delete-lookup             Delete a user_lookup entry
 *   set-role <uid> <role>     Set a user's role (Admin|User|Donor|Beneficiary)
 *   activate <uid>            Set a user's status to Active
 *   deactivate <uid>          Set a user's status to Inactive
 *   help                      Show this help
 *
 * Examples:
 *   node scripts/admin-tools.js reset-password
 *   node scripts/admin-tools.js reset-password --email abusufiyan.belif@gmail.com
 *   node scripts/admin-tools.js print-user S5efNV5jpTPoxYNv6SnAlv3jNPO2
 *   node scripts/admin-tools.js print-user abusufiyan.belif@gmail.com
 *   node scripts/admin-tools.js scan-users
 *   node scripts/admin-tools.js set-role S5efNV5jpTPoxYNv6SnAlv3jNPO2 Admin
 */

'use strict';

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────
// SDK INIT
// ─────────────────────────────────────────────

const saPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}

if (!admin.apps.length) {
    const sa = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const auth = admin.auth();
const db = admin.firestore();

// ─────────────────────────────────────────────
// SOVEREIGN ADMIN LIST (for reset-admins)
// ─────────────────────────────────────────────

const SOVEREIGN_ADMINS = [
    { email: 'baitulmalss.solapur@gmail.com', label: 'BaitulMal System Admin' },
    { email: 'abusufiyan.belif@gmail.com',    label: 'Abusufiyan Belif (Super Admin)' },
    { email: 'maazshaikh.official@gmail.com', label: 'Maaz A. Rauf Shaikh' },
];

// ─────────────────────────────────────────────
// READLINE HELPERS (interactive prompts)
// ─────────────────────────────────────────────

function createRL() {
    return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

/** Ask for a password — shows * while typing on supported terminals. */
function askPassword(rl, question) {
    return new Promise(resolve => {
        const isTTY = process.stdin.isTTY;

        if (!isTTY) {
            // Non-interactive (piped input): just read normally
            rl.question(question, answer => resolve(answer.trim()));
            return;
        }

        process.stdout.write(question);
        let pwd = '';
        const onData = (char) => {
            char = char + '';
            switch (char) {
                case '\n':
                case '\r':
                case '\u0004': // Ctrl-D
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    resolve(pwd);
                    break;
                case '\u0003': // Ctrl-C
                    process.stdout.write('\n');
                    process.exit(0);
                    break;
                case '\u007F': // Backspace
                    if (pwd.length > 0) {
                        pwd = pwd.slice(0, -1);
                        process.stdout.clearLine(0);
                        process.stdout.cursorTo(0);
                        process.stdout.write(question + '*'.repeat(pwd.length));
                    }
                    break;
                default:
                    pwd += char;
                    process.stdout.write('*');
            }
        };

        try {
            process.stdin.setRawMode(true);
        } catch (_) {
            // setRawMode not available — fallback to plain read
            rl.question(question, answer => resolve(answer.trim()));
            return;
        }
        process.stdin.resume();
        process.stdin.on('data', onData);
    });
}

// ─────────────────────────────────────────────
// ARG PARSING
// ─────────────────────────────────────────────

function parseArgs(argv) {
    const args = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
        } else {
            positional.push(argv[i]);
        }
    }
    return { args, positional };
}

// ─────────────────────────────────────────────
// COMMAND: reset-password
// ─────────────────────────────────────────────

async function cmdResetPassword(args) {
    const rl = createRL();

    try {
        let email = args.email || '';
        let password = args.password || '';

        if (!email) {
            email = await ask(rl, '📧 Enter email address: ');
        }

        if (!email.includes('@')) {
            console.error('❌ Invalid email format.');
            rl.close();
            return;
        }

        if (!password) {
            password = await askPassword(rl, '🔑 Enter new password (min 6 chars): ');
            const confirm = await askPassword(rl, '🔑 Confirm new password: ');
            if (password !== confirm) {
                console.error('❌ Passwords do not match. Aborted.');
                rl.close();
                return;
            }
        }

        if (password.length < 6) {
            console.error('❌ Password must be at least 6 characters.');
            rl.close();
            return;
        }

        console.log(`\n⏳ Looking up Firebase Auth user for: ${email}...`);
        const userRecord = await auth.getUserByEmail(email);

        console.log(`   Found UID: ${userRecord.uid} | Display: ${userRecord.displayName || '(none)'}`);

        await auth.updateUser(userRecord.uid, { password });
        console.log(`✅ Password updated successfully for ${email}`);

        // Optionally sync to Firestore users doc (if 'password' field is stored there for portal login)
        const userDoc = await db.collection('users').doc(userRecord.uid).get();
        if (userDoc.exists && userDoc.data().password !== undefined) {
            await db.collection('users').doc(userRecord.uid).update({
                password,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ↳ Also synced to Firestore users doc (portal password field).`);
        }

        // Check donors collection too
        const donorDoc = await db.collection('donors').doc(userRecord.uid).get();
        if (donorDoc.exists && donorDoc.data().password !== undefined) {
            await db.collection('donors').doc(userRecord.uid).update({
                password,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`   ↳ Also synced to Firestore donors doc (portal password field).`);
        }

    } finally {
        rl.close();
    }
}

// ─────────────────────────────────────────────
// COMMAND: reset-admins (all sovereign admins)
// ─────────────────────────────────────────────

async function cmdResetAdmins() {
    const rl = createRL();

    try {
        console.log('\n👑 Sovereign Admin Accounts:');
        SOVEREIGN_ADMINS.forEach((a, i) => console.log(`   ${i + 1}. ${a.label} (${a.email})`));

        const newPassword = await askPassword(rl, '\n🔑 Enter new password for ALL admins: ');
        const confirm = await askPassword(rl, '🔑 Confirm password: ');

        if (newPassword !== confirm) {
            console.error('❌ Passwords do not match. Aborted.');
            rl.close();
            return;
        }

        if (newPassword.length < 6) {
            console.error('❌ Password must be at least 6 characters.');
            rl.close();
            return;
        }

        const proceed = await ask(rl, `\n⚠️  Reset password for all ${SOVEREIGN_ADMINS.length} admin accounts? (yes/no): `);
        if (proceed.toLowerCase() !== 'yes') {
            console.log('Aborted.');
            rl.close();
            return;
        }

        console.log('');
        for (const admin_acc of SOVEREIGN_ADMINS) {
            try {
                const userRecord = await auth.getUserByEmail(admin_acc.email);
                await auth.updateUser(userRecord.uid, { password: newPassword });
                console.log(`✅ ${admin_acc.label} (${admin_acc.email}) — password reset.`);
            } catch (e) {
                console.log(`⚠️  ${admin_acc.label} (${admin_acc.email}) — skipped: ${e.message}`);
            }
        }

        console.log('\n✅ Done.');
    } finally {
        rl.close();
    }
}

// ─────────────────────────────────────────────
// COMMAND: print-user
// ─────────────────────────────────────────────

async function cmdPrintUser(identifier) {
    if (!identifier) {
        console.error('❌ Usage: print-user <uid|email>');
        return;
    }

    console.log(`\n⏳ Looking up: ${identifier}...`);

    let uid = identifier;

    // If it looks like an email, resolve to UID first
    if (identifier.includes('@')) {
        try {
            const userRecord = await auth.getUserByEmail(identifier);
            uid = userRecord.uid;
            console.log(`   Firebase Auth UID: ${uid}`);
            console.log(`   Display Name: ${userRecord.displayName || '(none)'}`);
            console.log(`   Email Verified: ${userRecord.emailVerified}`);
            console.log(`   Disabled: ${userRecord.disabled}`);
        } catch (e) {
            console.error(`❌ Firebase Auth lookup failed: ${e.message}`);
        }
    } else {
        // Try to get Auth record by UID
        try {
            const userRecord = await auth.getUser(uid);
            console.log(`   Firebase Auth — Email: ${userRecord.email} | Display: ${userRecord.displayName || '(none)'} | Disabled: ${userRecord.disabled}`);
        } catch (e) {
            console.log(`   ⚠️  Firebase Auth record not found for UID: ${uid} (${e.message})`);
        }
    }

    // Firestore users doc
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        // Mask password if present
        if (data.password) data.password = '*** (masked) ***';
        console.log('\n📄 Firestore /users doc:');
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log(`\n⚠️  No Firestore /users doc found for UID: ${uid}`);
    }

    // Firestore donors doc
    const donorDoc = await db.collection('donors').doc(uid).get();
    if (donorDoc.exists) {
        const data = donorDoc.data();
        if (data.password) data.password = '*** (masked) ***';
        console.log('\n📄 Firestore /donors doc:');
        console.log(JSON.stringify(data, null, 2));
    }

    // user_lookups
    const lookupSnap = await db.collection('user_lookups').where('uid', '==', uid).get();
    if (!lookupSnap.empty) {
        console.log('\n🔑 user_lookups entries:');
        lookupSnap.forEach(d => console.log(`   [${d.id}]:`, JSON.stringify(d.data())));
    } else {
        // Try to find by email
        const emailLookup = await db.collection('user_lookups').where('email', '==', identifier).get();
        if (!emailLookup.empty) {
            console.log('\n🔑 user_lookups entries:');
            emailLookup.forEach(d => console.log(`   [${d.id}]:`, JSON.stringify(d.data())));
        } else {
            console.log('\n   No user_lookups entries found.');
        }
    }
}

// ─────────────────────────────────────────────
// COMMAND: scan-users
// ─────────────────────────────────────────────

async function cmdScanUsers() {
    const snap = await db.collection('users').get();
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  USERS (${snap.size} total)`);
    console.log(`${'═'.repeat(60)}`);

    snap.forEach(d => {
        const data = d.data();
        const permModules = data.permissions ? Object.keys(data.permissions) : [];
        console.log(JSON.stringify({
            uid: d.id,
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            loginId: data.loginId,
            role: data.role,
            status: data.status,
            organizationGroup: data.organizationGroup || null,
            organizationRole: data.organizationRole || null,
            hasPassword: !!data.password,
            permModules,
        }, null, 2));
        console.log('─'.repeat(40));
    });

    await cmdScanLookups();
}

// ─────────────────────────────────────────────
// COMMAND: scan-lookups
// ─────────────────────────────────────────────

async function cmdScanLookups() {
    const snap = await db.collection('user_lookups').get();
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  USER_LOOKUPS (${snap.size} entries)`);
    console.log(`${'═'.repeat(60)}`);
    snap.forEach(d => {
        console.log(`  [${d.id}] →`, JSON.stringify(d.data()));
    });
}

// ─────────────────────────────────────────────
// COMMAND: add-lookup
// ─────────────────────────────────────────────

async function cmdAddLookup() {
    const rl = createRL();
    try {
        const lookupId = await ask(rl, '🔑 Lookup key (phone/loginId/email, e.g. +919876543210): ');
        const email    = await ask(rl, '📧 Firebase Auth email this key resolves to: ');
        const uid      = await ask(rl, '🆔 UID (optional, press Enter to skip): ');

        const payload = { email };
        if (uid) payload.uid = uid;

        await db.collection('user_lookups').doc(lookupId).set(payload, { merge: true });
        console.log(`✅ user_lookups["${lookupId}"] = ${JSON.stringify(payload)}`);
    } finally {
        rl.close();
    }
}

// ─────────────────────────────────────────────
// COMMAND: delete-lookup
// ─────────────────────────────────────────────

async function cmdDeleteLookup() {
    const rl = createRL();
    try {
        const lookupId = await ask(rl, '🔑 Lookup key to delete: ');
        const doc = await db.collection('user_lookups').doc(lookupId).get();
        if (!doc.exists) {
            console.error(`❌ user_lookups["${lookupId}"] does not exist.`);
            return;
        }
        console.log(`   Found: ${JSON.stringify(doc.data())}`);
        const confirm = await ask(rl, `⚠️  Delete user_lookups["${lookupId}"]? (yes/no): `);
        if (confirm.toLowerCase() !== 'yes') { console.log('Aborted.'); return; }
        await db.collection('user_lookups').doc(lookupId).delete();
        console.log('✅ Deleted.');
    } finally {
        rl.close();
    }
}

// ─────────────────────────────────────────────
// COMMAND: set-role
// ─────────────────────────────────────────────

async function cmdSetRole(uid, role) {
    const validRoles = ['Admin', 'User', 'Donor', 'Beneficiary'];
    if (!uid || !role) {
        console.error('❌ Usage: set-role <uid> <Admin|User|Donor|Beneficiary>');
        return;
    }
    if (!validRoles.includes(role)) {
        console.error(`❌ Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`);
        return;
    }
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
        console.error(`❌ User document not found for UID: ${uid}`);
        return;
    }
    const prev = doc.data().role;
    await db.collection('users').doc(uid).update({
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Role updated: ${prev} → ${role} for UID: ${uid} (${doc.data().name || 'unknown'})`);
}

// ─────────────────────────────────────────────
// COMMAND: activate / deactivate
// ─────────────────────────────────────────────

async function cmdSetStatus(uid, status) {
    if (!uid) {
        console.error(`❌ Usage: ${status.toLowerCase()} <uid>`);
        return;
    }
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
        console.error(`❌ User document not found for UID: ${uid}`);
        return;
    }
    const prev = doc.data().status;
    await db.collection('users').doc(uid).update({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    // Also update Firebase Auth disabled flag
    try {
        await auth.updateUser(uid, { disabled: status === 'Inactive' });
    } catch (e) {
        console.log(`   ⚠️  Firebase Auth update skipped: ${e.message}`);
    }
    console.log(`✅ Status: ${prev} → ${status} for UID: ${uid} (${doc.data().name || 'unknown'})`);
}

// ─────────────────────────────────────────────
// HELP
// ─────────────────────────────────────────────

function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║              BaitulMal Admin Toolkit — admin-tools.js        ║
╚══════════════════════════════════════════════════════════════╝

Usage:  node scripts/admin-tools.js <command> [options]

Commands:
  reset-password                Reset one user's Firebase Auth password (interactive)
  reset-password --email <e>    Pre-fill email (still prompts for password)
  reset-password --email <e> --password <p>  Fully non-interactive

  reset-admins                  Reset all sovereign admin accounts (interactive)

  print-user <uid|email>        Print full Firestore profile + Auth details

  scan-users                    List all users and user_lookups
  scan-lookups                  List user_lookups only

  add-lookup                    Add/update a user_lookup entry (interactive)
  delete-lookup                 Delete a user_lookup entry (interactive)

  set-role <uid> <role>         Set user role (Admin|User|Donor|Beneficiary)
  activate <uid>                Set user status to Active
  deactivate <uid>              Set user status to Inactive

  help                          Show this help

Examples:
  node scripts/admin-tools.js reset-password
  node scripts/admin-tools.js reset-password --email abusufiyan.belif@gmail.com
  node scripts/admin-tools.js print-user S5efNV5jpTPoxYNv6SnAlv3jNPO2
  node scripts/admin-tools.js print-user baitulmalss.solapur@gmail.com
  node scripts/admin-tools.js scan-users
  node scripts/admin-tools.js set-role S5efNV5jpTPoxYNv6SnAlv3jNPO2 Admin
  node scripts/admin-tools.js activate cyMl1lQME0Yur1YS3VCms1AvrOJ2
`);
}

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────

async function main() {
    const rawArgs = process.argv.slice(2);
    const { args, positional } = parseArgs(rawArgs);
    const command = positional[0] || 'help';

    console.log(`\n🛠️  BaitulMal Admin Toolkit — Command: ${command}\n`);

    switch (command) {
        case 'reset-password':
            await cmdResetPassword(args);
            break;

        case 'reset-admins':
            await cmdResetAdmins();
            break;

        case 'print-user':
            await cmdPrintUser(positional[1] || args.uid || args.email);
            break;

        case 'scan-users':
            await cmdScanUsers();
            break;

        case 'scan-lookups':
            await cmdScanLookups();
            break;

        case 'add-lookup':
            await cmdAddLookup();
            break;

        case 'delete-lookup':
            await cmdDeleteLookup();
            break;

        case 'set-role':
            await cmdSetRole(positional[1], positional[2]);
            break;

        case 'activate':
            await cmdSetStatus(positional[1], 'Active');
            break;

        case 'deactivate':
            await cmdSetStatus(positional[1], 'Inactive');
            break;

        case 'help':
        case '--help':
        case '-h':
            showHelp();
            break;

        default:
            console.error(`❌ Unknown command: "${command}"\n`);
            showHelp();
            process.exit(1);
    }

    process.exit(0);
}

main().catch(e => {
    console.error('\n❌ Fatal error:', e.message);
    process.exit(1);
});
