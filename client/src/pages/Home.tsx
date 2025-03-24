import { useState } from "react";
import Header from "@/components/Header";
import FileUploader from "@/components/FileUploader";
import UploadList from "@/components/UploadList";
import CampaignSection from "@/components/CampaignSection";
import StatusSection from "@/components/StatusSection";
import HelpSection from "@/components/HelpSection";
import { useToast } from "@/hooks/use-toast";
import { useMetaAuth } from "@/hooks/useMetaAuth";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useCampaigns } from "@/hooks/useCampaigns";
import { FileUpload, Campaign, ActivityLog } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, logout, login } = useMetaAuth();
  const { uploadedFiles, uploadFiles, removeFile, uploadProgress } = useFileUpload();
  const { 
    campaigns, 
    isLoading: campaignsLoading, 
    selectedCampaigns, 
    toggleCampaign, 
    selectAllCampaigns, 
    searchCampaigns,
    launchCreatives 
  } = useCampaigns();

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Calculate status summary
  const statusSummary = {
    prepared: `${uploadedFiles.filter(f => f.status === 'ready').length}/${uploadedFiles.length}`,
    campaignsSelected: `${selectedCampaigns.length}/${campaigns.length}`,
    launched: `${uploadedFiles.filter(f => f.status === 'completed').length}/${uploadedFiles.length}`
  };

  // Handle file upload
  const handleFilesSelected = (files: File[]) => {
    uploadFiles(files, (log) => {
      setActivityLogs(prev => [log, ...prev]);
      toast({
        title: log.type === 'error' ? 'Error' : 'Success',
        description: log.message,
        variant: log.type === 'error' ? 'destructive' : 'default',
      });
    });
  };

  // Handle creative launch
  const handleLaunchCreatives = async () => {
    if (selectedCampaigns.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one campaign",
        variant: "destructive",
      });
      return;
    }

    if (uploadedFiles.filter(f => f.status === 'ready').length === 0) {
      toast({
        title: "Error",
        description: "No files ready to launch",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await launchCreatives(
        uploadedFiles.filter(f => f.status === 'ready'),
        selectedCampaigns
      );
      
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        type: 'success',
        message: `Launched ${result.successCount} creatives to ${selectedCampaigns.length} campaigns`,
        timestamp: new Date().toISOString()
      };
      
      setActivityLogs(prev => [newLog, ...prev]);
      
      toast({
        title: "Success",
        description: newLog.message,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to launch creatives';
      
      const newLog: ActivityLog = {
        id: Date.now().toString(),
        type: 'error',
        message: errorMessage,
        timestamp: new Date().toISOString()
      };
      
      setActivityLogs(prev => [newLog, ...prev]);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header isAuthenticated={isAuthenticated} onLogout={logout} onLogin={login} />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2/3 on desktop) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Upload Ad Creative</h2>
                <FileUploader onFilesSelected={handleFilesSelected} />
                <UploadList 
                  files={uploadedFiles} 
                  onRemoveFile={removeFile} 
                  uploadProgress={uploadProgress} 
                />
              </div>
              
              <CampaignSection 
                campaigns={campaigns}
                isLoading={campaignsLoading}
                selectedCampaigns={selectedCampaigns}
                onToggleCampaign={toggleCampaign}
                onSelectAll={selectAllCampaigns}
                onSearch={searchCampaigns}
                onLaunchCreatives={handleLaunchCreatives}
              />
            </div>
            
            {/* Right Column (1/3 on desktop) */}
            <div className="space-y-6">
              <StatusSection 
                statusSummary={statusSummary}
                activityLogs={activityLogs}
              />
              <HelpSection />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
