import { useState } from "react";
import Header from "@/components/Header";
import FileUploader from "@/components/FileUploader";
import UploadList from "@/components/UploadList";
import CampaignSection from "@/components/CampaignSection";
import StatusSection from "@/components/StatusSection";
import HelpSection from "@/components/HelpSection";
import MetaSetupAlert from "@/components/MetaSetupAlert";
import { useToast } from "@/hooks/use-toast";
import { useMetaAuth } from "@/hooks/useMetaAuth";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useCampaigns } from "@/hooks/useCampaigns";
import { FileUpload, Campaign, FrontendActivityLog } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { CloudDownload } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, logout, login } = useMetaAuth();
  const { uploadedFiles, uploadFiles, removeFile, uploadProgress, addGoogleDriveFiles } = useFileUpload();
  const { 
    campaigns, 
    isLoading: campaignsLoading, 
    selectedCampaigns, 
    toggleCampaign, 
    selectAllCampaigns, 
    searchCampaigns,
    launchCreatives 
  } = useCampaigns();

  const [activityLogs, setActivityLogs] = useState<FrontendActivityLog[]>([]);
  const [loadingGoogleDriveVideos, setLoadingGoogleDriveVideos] = useState(false);

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

  // Load AI-generated batch folders from Google Drive
  const [batchFolders, setBatchFolders] = useState<any[]>([]);
  const [selectedBatchFolder, setSelectedBatchFolder] = useState<string | null>(null);
  const [showBatchFolders, setShowBatchFolders] = useState(false);

  const handleLoadGoogleDriveVideos = async () => {
    setLoadingGoogleDriveVideos(true);
    try {
      // Use the hardcoded folder ID from user's Shared Drive to get batch folders
      const folderId = '1AIe9UvmYnBJiJyD1rMzLZRNqKDw-BWJh';
      const response = await fetch(`/api/drive/folder/${folderId}/batch-folders`);
      const data = await response.json();
      
      if (data.folders && data.folders.length > 0) {
        setBatchFolders(data.folders);
        setShowBatchFolders(true);
        
        const logEntry: FrontendActivityLog = {
          id: Date.now().toString(),
          type: 'success',
          message: `Found ${data.folders.length} video batch folders from Google Drive`,
          timestamp: new Date().toISOString()
        };
        setActivityLogs(prev => [logEntry, ...prev]);
        
        toast({
          title: "Batch Folders Found!",
          description: `Select from ${data.folders.length} timestamped video batches`,
        });
      } else {
        toast({
          title: "No Video Batches Found",
          description: "No timestamped video folders found. Generate some scripts first!",
          variant: "destructive",
        });
      }
    } catch (error) {
      const logEntry: FrontendActivityLog = {
        id: Date.now().toString(),
        type: 'error',
        message: 'Failed to load Google Drive batch folders',
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load batch folders from Google Drive",
        variant: "destructive",
      });
    } finally {
      setLoadingGoogleDriveVideos(false);
    }
  };

  // Load videos from a selected batch folder
  const handleLoadVideosFromBatchFolder = async (folderId: string, folderName: string) => {
    setLoadingGoogleDriveVideos(true);
    try {
      const response = await fetch(`/api/drive/folder/${folderId}/videos`);
      const data = await response.json();
      
      if (data.success && data.videos) {
        // Add Google Drive videos to the upload list
        addGoogleDriveFiles(data.videos);
        
        const logEntry: FrontendActivityLog = {
          id: Date.now().toString(),
          type: 'success',
          message: `Loaded ${data.videos.length} videos from batch folder: ${folderName}`,
          timestamp: new Date().toISOString()
        };
        setActivityLogs(prev => [logEntry, ...prev]);
        
        toast({
          title: "Success",
          description: `Loaded ${data.videos.length} videos from ${folderName}`,
        });
        
        setShowBatchFolders(false);
      } else {
        throw new Error(data.message || 'No videos found in folder');
      }
    } catch (error) {
      const logEntry: FrontendActivityLog = {
        id: Date.now().toString(),
        type: 'error',
        message: `Failed to load videos from batch folder: ${folderName}`,
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [logEntry, ...prev]);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load videos from batch folder",
        variant: "destructive",
      });
    } finally {
      setLoadingGoogleDriveVideos(false);
    }
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
      
      // Handle partial success
      if (result.successCount > 0 && result.errorCount > 0) {
        const newLog: FrontendActivityLog = {
          id: Date.now().toString(),
          type: 'success',
          message: `Partially launched creatives: ${result.successCount} successful, ${result.errorCount} failed`,
          timestamp: new Date().toISOString()
        };
        
        setActivityLogs(prev => [newLog, ...prev]);
        
        toast({
          title: "Partial Success",
          description: newLog.message,
        });
        
        // Add error logs for each error
        if (result.errors && result.errors.length > 0) {
          for (const errorMsg of result.errors) {
            const errorLog: FrontendActivityLog = {
              id: Date.now().toString() + Math.random(),
              type: 'error',
              message: errorMsg,
              timestamp: new Date().toISOString()
            };
            setActivityLogs(prev => [errorLog, ...prev]);
          }
        }
      } 
      // Full success
      else if (result.successCount > 0) {
        const newLog: FrontendActivityLog = {
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
      } 
      // No successes at all
      else {
        throw new Error("No creatives were successfully launched");
      }
    } catch (error) {
      // Create a user-friendly error message
      let errorMessage = 'Failed to launch creatives';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error patterns
        if (errorMessage.includes("No ad sets found")) {
          errorMessage = "Creating ad set automatically. Please try again in a few seconds.";
        } else if (errorMessage.includes("Failed to create ad set")) {
          errorMessage = "Unable to create ad set. The campaign may have invalid settings.";
        } else if (errorMessage.includes("Invalid Page ID") || errorMessage.includes("The Page ID specified")) {
          errorMessage = "A real Facebook Page is required to create ads. The test page cannot be used for publishing actual ads. Please connect your Facebook Business Page in Meta Ads Manager.";
        } else if (errorMessage.includes("app_id is required") || errorMessage.includes("application is required")) {
          errorMessage = "App installation campaigns require a valid mobile app to be connected to your Meta account. Please check your app configuration in Meta Ads Manager.";
        }
      }
      
      const newLog: FrontendActivityLog = {
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
          {isAuthenticated && <MetaSetupAlert />}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2/3 on desktop) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Upload Ad Creative</h2>
                  <Button 
                    onClick={handleLoadGoogleDriveVideos}
                    disabled={loadingGoogleDriveVideos}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <CloudDownload className="h-4 w-4" />
                    {loadingGoogleDriveVideos ? 'Loading...' : 'Load AI Videos'}
                  </Button>
                </div>
                
                {/* Batch Folder Selection Modal */}
                {showBatchFolders && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-semibold mb-3 text-blue-800">Select Video Batch</h3>
                    <p className="text-xs text-blue-600 mb-3">
                      Choose a timestamped batch folder containing AI-generated videos:
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {batchFolders.map((folder) => (
                        <div key={folder.id} className="flex items-center justify-between p-3 bg-white border rounded">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{folder.name}</div>
                            <div className="text-xs text-gray-500">
                              {folder.videoCount} videos • Modified: {new Date(folder.modifiedTime || '').toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleLoadVideosFromBatchFolder(folder.id, folder.name)}
                            disabled={loadingGoogleDriveVideos}
                          >
                            {loadingGoogleDriveVideos ? 'Loading...' : 'Load Videos'}
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBatchFolders(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

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
