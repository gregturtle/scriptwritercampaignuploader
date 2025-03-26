import { useMetaStatus } from "@/hooks/useMetaStatus";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MetaSetupAlert() {
  const { 
    isLoading, 
    isAuthenticated,
    needsSetup,
    setupIssue,
    setupMessage,
    isConfigured
  } = useMetaStatus();

  if (isLoading) {
    return (
      <div className="mb-6">
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Don't show anything if not authenticated
    return null;
  }

  if (isConfigured) {
    return (
      <Alert className="mb-6 bg-green-50 border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-800">Meta API Connected</AlertTitle>
        <AlertDescription className="text-green-700">
          Your Meta account is properly configured and ready to use.
        </AlertDescription>
      </Alert>
    );
  }

  if (needsSetup) {
    let title = "Setup Required";
    let icon = <AlertTriangle className="h-5 w-5 text-amber-600" />;
    let alertClass = "mb-6 bg-amber-50 border-amber-200";
    let titleClass = "text-amber-800";
    let descriptionClass = "text-amber-700";

    if (setupIssue === 'error') {
      alertClass = "mb-6 bg-red-50 border-red-200";
      titleClass = "text-red-800";
      descriptionClass = "text-red-700";
      icon = <AlertCircle className="h-5 w-5 text-red-600" />;
      title = "Error";
    }

    return (
      <Alert className={alertClass}>
        {icon}
        <AlertTitle className={titleClass}>{title}</AlertTitle>
        <AlertDescription className={descriptionClass}>
          {setupMessage}
          {setupIssue === 'missing_page' && (
            <div className="mt-2">
              <div className="p-2 border border-amber-200 bg-amber-50 rounded-md mb-2">
                <strong className="text-amber-800">⚠️ Important:</strong> 
                <span className="text-amber-800"> The application is using a Meta API Test Page, which 
                allows browsing and setup but </span>
                <span className="font-bold underline text-amber-900">cannot be used to publish actual ads</span>. 
              </div>
              
              <p className="mb-2">To fully use this application, please connect a real Facebook Page to your ad account
              in Meta Business Manager.</p>
              
              <div className="mt-3 mb-2 font-medium">Setup Requirements:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                <div className="border border-amber-100 rounded-md p-3 bg-amber-50/50">
                  <h4 className="font-medium mb-1 text-amber-900">For Standard Campaigns:</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>A Facebook Page connected to your Ad Account</li>
                    <li>Ad account with active payment method</li>
                    <li>Valid access token with ads_management permission</li>
                  </ul>
                </div>
                <div className="border border-blue-100 rounded-md p-3 bg-blue-50/50">
                  <h4 className="font-medium mb-1 text-blue-900">For App Install Campaigns:</h4>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>All Standard Campaign requirements</li>
                    <li>App registered in Meta's App Dashboard</li>
                    <li>App Store and/or Google Play Store links configured</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-3 text-sm border-t pt-3 border-amber-100">
                <strong>How to connect a Facebook Page:</strong>
                <ol className="list-decimal pl-5 mt-1 space-y-1">
                  <li>Go to <a href="https://business.facebook.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Meta Business Manager</a></li>
                  <li>Navigate to Business Settings</li>
                  <li>Select Pages from the Accounts section</li>
                  <li>Add your Facebook Page to your business</li>
                  <li>Associate it with your Ad Account</li>
                </ol>
              </div>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}