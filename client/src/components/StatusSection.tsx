import { formatDistanceToNow } from "date-fns";
import { Info, AlertTriangle, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityLog } from "@shared/schema";

interface StatusSectionProps {
  statusSummary: {
    prepared: string;
    campaignsSelected: string;
    launched: string;
  };
  activityLogs: ActivityLog[];
}

export default function StatusSection({ statusSummary, activityLogs }: StatusSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Upload Status</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-300">Files prepared</div>
          <div className="text-sm font-medium text-neutral-900">{statusSummary.prepared}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-300">Campaigns selected</div>
          <div className="text-sm font-medium text-neutral-900">{statusSummary.campaignsSelected}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-300">Creatives launched</div>
          <div className="text-sm font-medium text-neutral-900">{statusSummary.launched}</div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-neutral-200">
          <h3 className="text-sm font-medium text-neutral-900 mb-3">Recent Activity</h3>
          <ScrollArea className="h-60">
            <div className="space-y-2">
              {activityLogs.length === 0 ? (
                <div className="text-xs text-neutral-300 text-center py-2">
                  No activity yet
                </div>
              ) : (
                activityLogs.map(log => (
                  <div key={log.id} className="flex items-start space-x-2 text-xs">
                    {log.type === 'info' && <Info className="h-4 w-4 text-neutral-300" />}
                    {log.type === 'error' && <AlertTriangle className="h-4 w-4 text-error" />}
                    {log.type === 'success' && <CheckCircle className="h-4 w-4 text-secondary" />}
                    <div>
                      <p className="text-neutral-900">{log.message}</p>
                      <p className="text-neutral-300">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
