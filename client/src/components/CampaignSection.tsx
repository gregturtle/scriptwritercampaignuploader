import { Search, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Campaign } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

// Helper function to determine if a campaign is for app installs
function isAppInstallCampaign(objective?: string | null): boolean {
  return objective === 'APP_INSTALLS' || objective === 'OUTCOME_APP_PROMOTION';
}

// Helper function to get campaign type text
function getCampaignTypeText(objective?: string | null): string {
  return isAppInstallCampaign(objective) ? 'App Install' : 'Standard';
}

// Helper function to render campaign type badge
function getCampaignTypeBadge(objective?: string | null) {
  if (isAppInstallCampaign(objective)) {
    return (
      <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200 font-normal flex items-center gap-1">
        <Smartphone className="h-3 w-3" />
        <span>App Install</span>
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-700 border-slate-200 font-normal flex items-center gap-1">
      <ExternalLink className="h-3 w-3" />
      <span>Standard</span>
    </Badge>
  );
}

interface CampaignSectionProps {
  campaigns: Campaign[];
  isLoading: boolean;
  selectedCampaigns: string[];
  onToggleCampaign: (campaignId: string) => void;
  onSelectAll: (selected: boolean) => void;
  onSearch: (query: string) => void;
  onLaunchCreatives: () => void;
}

export default function CampaignSection({
  campaigns,
  isLoading,
  selectedCampaigns,
  onToggleCampaign,
  onSelectAll,
  onSearch,
  onLaunchCreatives
}: CampaignSectionProps) {
  const allSelected = campaigns.length > 0 && selectedCampaigns.length === campaigns.length;
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleSelectAll = () => {
    onSelectAll(!allSelected);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Select Campaigns</h2>
        <div className="relative">
          <Input
            type="text"
            className="pl-10 pr-3 py-2"
            placeholder="Search campaigns..."
            onChange={handleSearchChange}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-neutral-300" />
          </div>
        </div>
      </div>
      
      <div className="overflow-hidden border border-neutral-200 rounded-lg">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                <div className="flex items-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                Campaign Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider">
                Budget
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-neutral-300">
                  Loading campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-neutral-300">
                  No campaigns found. Connect to Meta to load campaigns.
                </td>
              </tr>
            ) : (
              campaigns.map(campaign => (
                <tr key={campaign.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Checkbox
                        checked={selectedCampaigns.includes(campaign.id)}
                        onCheckedChange={() => onToggleCampaign(campaign.id)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-neutral-900">{campaign.name}</div>
                    <div className="text-xs text-neutral-500">ID: {campaign.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isAppInstallCampaign(campaign.objective) ? (
                      <div className="flex items-center">
                        <Smartphone className="h-4 w-4 text-blue-600 mr-1.5" />
                        <span className="text-sm text-blue-700">App Install</span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <ExternalLink className="h-4 w-4 text-slate-600 mr-1.5" />
                        <span className="text-sm text-slate-700">Standard</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-medium rounded-full ${
                      campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300">
                    ${campaign.budget.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex justify-end">
        <Button
          onClick={onLaunchCreatives}
          className="bg-primary hover:bg-primary/90 inline-flex items-center"
          disabled={selectedCampaigns.length === 0}
        >
          <span className="material-icons mr-1 text-sm">rocket_launch</span>
          Launch to Selected Campaigns
        </Button>
      </div>
    </div>
  );
}
