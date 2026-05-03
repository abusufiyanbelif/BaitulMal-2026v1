const fs = require('fs');
const path = "c:/Users/Admin/Documents/baitulamal_2026v1/src/app/verifications/actions.ts";
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings to LF for easier regex
content = content.replace(/\r\n/g, '\n');

// 1. Update approveVerificationAction update block
const pattern1 = /\/\/ Cleanup: Delete the pending request\s+await docRef\.delete\(\);/;
const new1 = `// Cleanup: Delete the pending request if fully approved, otherwise update
             if (allApproved) {
                 await docRef.delete();
             } else {
                 await docRef.update({
                     assignedVerifiers: updatedVerifiers,
                     approverComments: updatedApproverComments,
                     status: status,
                     updatedAt: Timestamp.now()
                 });
             }`;

if (pattern1.test(content)) {
    content = content.replace(pattern1, new1);
} else {
    console.log('Pattern 1 not found');
}

// 2. Update rejectVerificationAction update block
const pattern2 = /\/\/ If anyone rejects, the whole thing is rejected\s+await docRef\.update\(\{ \s+status: 'Rejected',/;
const new2 = `// If anyone rejects, the whole thing is rejected
          const updatedApproverComments = [
              ...(request.approverComments || []),
              {
                  verifierId,
                  verifierName: request.assignedVerifiers.find(v => v.id === verifierId)?.name || 'Verifier',
                  comment: reason,
                  status: 'Rejected' as const,
                  updatedAt: Timestamp.now()
              }
          ];

          await docRef.update({ 
            status: 'Rejected',`;

if (pattern2.test(content)) {
    content = content.replace(pattern2, new2);
} else {
    console.log('Pattern 2 not found');
}

fs.writeFileSync(path, content.replace(/\n/g, '\r\n'));
console.log('File updated successfully');
