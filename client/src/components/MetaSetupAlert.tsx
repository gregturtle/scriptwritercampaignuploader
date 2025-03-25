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
              <strong>Note:</strong> The application will use a test page for development, 
              but for production use, you should connect a real Facebook Page to your ad account.
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}