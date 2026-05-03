const fs = require('fs');
const path = "c:/Users/Admin/Documents/baitulamal_2026v1/src/components/verification-manager.tsx";
let content = fs.readFileSync(path, 'utf8');

// 1. Add state
content = content.replace(
    /const \[isActionLoading, setIsActionLoading\] = useState\(false\);/,
    `const [isActionLoading, setIsActionLoading] = useState(false);\n    const [approvalComment, setApprovalComment] = useState('');`
);

// 2. Update handleApprove call
content = content.replace(
    /await approveVerificationAction\(selectedRequest\.id, userProfile\.id\)/,
    `await approveVerificationAction(selectedRequest.id, userProfile.id, approvalComment)`
);

// 3. Update handleApprove success cleanup
content = content.replace(
    /setSelectedRequest\(null\);/,
    `setSelectedRequest(null);\n          setApprovalComment('');`
);

// 4. Update Dialog Narrative section (Requested By + Audit Trail)
content = content.replace(
    /<div className="flex-1">[\s\S]*?<\/div>\s+<\/div>/,
    `<div className="flex-1">
                     <p className="text-[10px] font-bold text-primary/50 uppercase tracking-widest">Requested By</p>
                     <p className="text-lg font-bold text-primary">{selectedRequest?.requestedBy.name}</p>
                     <p className="text-xs font-medium text-primary/60 italic">
                       {operationType === 'CREATE' ? 'I am creating a new record.' : operationType === 'DELETE' ? 'I am requesting to remove this record.' : 'I have modified some fields in this record.'}
                     </p>
                   </div>
                </div>

                {(selectedRequest?.description || selectedRequest?.requesterComment || (selectedRequest?.approverComments && selectedRequest.approverComments.length > 0)) && (
                    <div className="p-6 bg-primary/[0.03] rounded-3xl border border-primary/5 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 h-full w-1 bg-primary group-hover:w-2 transition-all" />
                        <div className="flex items-center gap-2 mb-4 text-primary font-bold text-[10px] uppercase tracking-[0.2em] opacity-50">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Audit Trail & Narrative
                        </div>
                        <div className="space-y-4">
                            {selectedRequest?.description && (
                                <div>
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-1">Request Summary</p>
                                    <p className="text-sm font-bold text-primary/80 leading-relaxed">{selectedRequest.description}</p>
                                </div>
                            )}
                            {selectedRequest?.requesterComment && (
                                <div className="pt-3 border-t border-primary/5">
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-1">Requester Note</p>
                                    <p className="text-sm font-medium text-primary/70 bg-white/40 p-3 rounded-xl border border-primary/5 italic">
                                        "{selectedRequest.requesterComment}"
                                    </p>
                                </div>
                            )}
                            {selectedRequest?.approverComments && selectedRequest.approverComments.length > 0 && (
                                <div className="pt-3 border-t border-primary/5 space-y-3">
                                    <p className="text-[10px] font-black text-primary/40 uppercase mb-2">Reviewer Feedback</p>
                                    {selectedRequest.approverComments.map((ac, idx) => (
                                        <div key={idx} className="flex gap-3 items-start">
                                            <div className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                                                ac.status === 'Approved' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                            )}>
                                                {ac.verifierName.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-primary">{ac.verifierName}</span>
                                                    <Badge variant={ac.status === 'Approved' ? 'eligible' : 'destructive'} className="text-[8px] h-3.5 px-1 font-black">{ac.status.toUpperCase()}</Badge>
                                                </div>
                                                <p className="text-[11px] text-primary/60 font-medium leading-normal">{ac.comment}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}`
);

// 5. Replace DiffItem component
const diffItemPattern = /function DiffItem\(\{ label, oldVal, newVal, operation \}: \{ label: string, oldVal\?: any, newVal\?: any, operation: 'CREATE' | 'UPDATE' | 'DELETE' \}\) \{[\s\S]*?\n  \}/;
const diffItemReplacement = `function DiffItem({ label, oldVal, newVal, operation }: { label: string, oldVal?: any, newVal?: any, operation: 'CREATE' | 'UPDATE' | 'DELETE' }) {
  const isChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);
  if (operation === 'UPDATE' && !isChanged) return null;

  const formatValue = (v: any): string => {
    if (v === null || v === undefined) return 'Baseline';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') {
      if (Array.isArray(v)) {
        return v.length > 0 ? \`\${v.length} Elements\` : 'EMPTY_LIST';
      }
      return 'OBJECT_REF';
    }
    return String(v);
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm group hover:border-primary/20 transition-all overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">
          {label.replace(/([A-Z])/g, ' $1').trim()}
        </span>
        <Badge variant="outline" className="text-[8px] font-black h-4 px-2 tracking-widest opacity-40 border-primary/10">MODIFIED</Badge>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
        {operation !== 'CREATE' && (
          <div className="p-3 bg-red-50/40 rounded-xl border border-red-100/40 text-[10px] font-bold text-red-700/60 truncate shadow-inner">
            {formatValue(oldVal)}
          </div>
        )}
        
        {operation === 'UPDATE' && (
          <div className="flex justify-center">
            <ArrowRight className="h-3 w-3 text-primary/20" />
          </div>
        )}

        {operation !== 'DELETE' && (
          <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/40 text-[10px] font-black text-emerald-800 truncate shadow-inner">
            {formatValue(newVal)}
          </div>
        )}
      </div>
    </div>
  );
}`;

content = content.replace(diffItemPattern, diffItemReplacement);

// 6. Update Dialog Footer
content = content.replace(
    /<DialogFooter className="bg-primary\/5 p-8 border-t gap-3 sm:gap-0">[\s\S]*?<\/DialogFooter>/,
    `<DialogFooter className="bg-primary/5 p-8 border-t gap-4 flex-col sm:flex-row justify-between items-end">
               <div className="w-full sm:w-64 space-y-1.5">
                   <Label className="text-[9px] font-black text-primary/40 uppercase tracking-widest ml-1">Approval Feedback (Optional)</Label>
                   <Input 
                       placeholder="Add a note for the requester..." 
                       value={approvalComment}
                       onChange={(e) => setApprovalComment(e.target.value)}
                       className="h-10 rounded-xl border-primary/10 text-xs font-bold bg-white focus-visible:ring-primary/20"
                   />
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                 <Button 
                   variant="outline" 
                   className="font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors px-6 h-10 rounded-xl text-xs"
                   onClick={handleReject}
                   disabled={isActionLoading}
                 >
                   <XCircle className="mr-2 h-4 w-4 opacity-70" /> Reject Update
                 </Button>
                 <Button 
                   className="font-bold shadow-xl bg-primary hover:bg-primary/90 text-white px-8 h-10 rounded-xl transition-all active:scale-95 text-xs"
                   onClick={handleApprove}
                   disabled={isActionLoading}
                 >
                   {isActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                   Confirm And Apply
                 </Button>
               </div>
            </DialogFooter>`
);

// 7. Remove old description block since it's now in Audit Trail
content = content.replace(
    /\{selectedRequest\.description && \([\s\S]*?<\/div>\s+\)\}/,
    ''
);

fs.writeFileSync(path, content);
console.log('VerificationManager updated successfully');
