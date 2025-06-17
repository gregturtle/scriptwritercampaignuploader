import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, FileSpreadsheetIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";

interface DatePresets {
  yesterday: { since: string; until: string };
  last7Days: { since: string; until: string };
  last30Days: { since: string; until: string };
  thisMonth: { since: string; until: string };
}

interface ReportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  dataExported: number;
  dateRange: { since: string; until: string };
  createdNew: boolean;
}

export default function Reports() {
  const { toast } = useToast();
  const { campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  
  const [dateRange, setDateRange] = useState({
    since: "",
    until: ""
  });
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['spend', 'app_install']);

  // Available Facebook metrics
  const availableMetrics = [
    { id: 'spend', label: 'Spend', description: 'Total amount spent' },
    { id: 'app_install', label: 'App Installs', description: 'Mobile app install actions' },
    { id: 'add_to_cart', label: 'Save Location', description: 'save_location events' },
    { id: 'purchase', label: 'Purchases', description: 'Purchase conversions' },
    { id: 'view_content', label: 'Saved Show', description: 'saved_show events' },
    { id: 'search', label: 'Search', description: 'search events' },
    { id: 'lead', label: 'Level Achieved', description: 'account_id events' },
    { id: 'complete_registration', label: 'Sign Up', description: 'sign_up events' },
    { id: 'initiate_checkout', label: 'Directions', description: 'directions events' },
    { id: 'add_to_wishlist', label: 'Follow List', description: 'follow_list events' },
    { id: 'rate', label: 'Share', description: 'share events' },
    { id: 'achievement_unlocked', label: 'Search 3wa', description: 'search_3wa events' },
    { id: 'tutorial_completion', label: 'Onboarding Completed', description: 'ob_completed events' },
    { id: 'add_payment_info', label: 'View Grid', description: 'view_grid events' },
    { id: 'impressions', label: 'Impressions', description: 'Number of impressions' },
    { id: 'clicks', label: 'Clicks', description: 'Number of clicks' },
    { id: 'ctr', label: 'CTR', description: 'Click-through rate' },
    { id: 'cpc', label: 'CPC', description: 'Cost per click' },
    { id: 'cpm', label: 'CPM', description: 'Cost per thousand impressions' }
  ];
  
  // Fetch date presets
  const { data: datePresets } = useQuery<DatePresets>({
    queryKey: ["/api/reports/date-presets"],
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (data: {
      dateRange: { since: string; until: string };
      campaignIds?: string[];
      spreadsheetId?: string;
      metrics?: string[];
    }) => {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Report Generated Successfully",
        description: `Exported ${result.dataExported} records to Google Sheets`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Report Generation Failed",
        description: error.message || "Failed to generate performance report",
        variant: "destructive",
      });
    },
  });

  const handlePresetSelect = (preset: keyof DatePresets) => {
    if (datePresets && datePresets[preset]) {
      setDateRange(datePresets[preset]);
      setUseCustomDateRange(false);
    }
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId)
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleSelectAllCampaigns = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedCampaigns(campaigns.map((c: any) => c.id));
    } else {
      setSelectedCampaigns([]);
    }
  };

  const handleMetricToggle = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId)
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const handleSelectAllMetrics = (checked: boolean | "indeterminate") => {
    if (checked === true) {
      setSelectedMetrics(availableMetrics.map(m => m.id));
    } else {
      setSelectedMetrics([]);
    }
  };

  const handleGenerateReport = () => {
    const reportData: any = {
      campaignIds: selectedCampaigns.length > 0 ? selectedCampaigns : undefined,
      spreadsheetId: spreadsheetId || undefined,
      metrics: selectedMetrics.length > 0 ? selectedMetrics : undefined,
    };

    // Only include date range if both dates are provided
    if (dateRange.since && dateRange.until) {
      reportData.dateRange = dateRange;
    }

    generateReportMutation.mutate(reportData);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Reports</h1>
          <p className="text-muted-foreground">
            Export Meta campaign performance data to Google Sheets
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Date Range Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Date Range
            </CardTitle>
            <CardDescription>
              Select a specific time period, or leave empty to get all available historical data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect('yesterday')}
                disabled={!datePresets}
              >
                Yesterday
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect('last7Days')}
                disabled={!datePresets}
              >
                Last 7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect('last30Days')}
                disabled={!datePresets}
              >
                Last 30 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePresetSelect('thisMonth')}
                disabled={!datePresets}
              >
                This Month
              </Button>
            </div>

            {/* Custom date range */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="custom-range"
                  checked={useCustomDateRange}
                  onCheckedChange={(checked) => setUseCustomDateRange(checked === true)}
                />
                <Label htmlFor="custom-range">Custom date range</Label>
              </div>
              
              {useCustomDateRange && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="since">From</Label>
                    <Input
                      id="since"
                      type="date"
                      value={dateRange.since}
                      onChange={(e) => setDateRange(prev => ({ ...prev, since: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="until">To</Label>
                    <Input
                      id="until"
                      type="date"
                      value={dateRange.until}
                      onChange={(e) => setDateRange(prev => ({ ...prev, until: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Display selected range or auto mode */}
            <div className="p-3 bg-muted rounded-md">
              {dateRange.since && dateRange.until ? (
                <div>
                  <p className="text-sm font-medium">Selected Range:</p>
                  <p className="text-sm text-muted-foreground">
                    {dateRange.since} to {dateRange.until}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Auto Mode:</p>
                  <p className="text-sm text-muted-foreground">
                    Will pull all available historical data for selected campaigns
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Google Sheets Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheetIcon className="h-5 w-5" />
              Google Sheets
            </CardTitle>
            <CardDescription>
              Configure where to export your performance data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="spreadsheet-id">Spreadsheet ID (Optional)</Label>
              <Input
                id="spreadsheet-id"
                placeholder="Leave empty to create new sheet"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If provided, data will be added to existing spreadsheet
              </p>
            </div>
            
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm font-medium text-blue-900">
                📝 Setup Required
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Make sure to share your Google Sheet with the service account email from your credentials
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Selection</CardTitle>
          <CardDescription>
            Select specific campaigns or leave empty to include all campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading campaigns...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="select-all"
                  checked={selectedCampaigns.length === campaigns.length}
                  onCheckedChange={handleSelectAllCampaigns}
                />
                <Label htmlFor="select-all" className="font-medium">
                  Select All Campaigns ({campaigns.length})
                </Label>
              </div>
              
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center space-x-2 p-2 rounded border">
                    <Checkbox
                      id={`campaign-${campaign.id}`}
                      checked={selectedCampaigns.includes(campaign.id)}
                      onCheckedChange={() => handleCampaignToggle(campaign.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={`campaign-${campaign.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {campaign.name}
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {campaign.objective}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ID: {campaign.id}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedCampaigns.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedCampaigns.length} campaign(s) selected
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Metrics Selection</CardTitle>
          <CardDescription>
            Choose which Facebook metrics to include in your report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all-metrics"
                checked={selectedMetrics.length === availableMetrics.length}
                onCheckedChange={handleSelectAllMetrics}
              />
              <Label htmlFor="select-all-metrics" className="font-medium">
                Select All Metrics ({availableMetrics.length})
              </Label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableMetrics.map((metric) => (
                <div key={metric.id} className="flex items-start space-x-2 p-3 rounded border">
                  <Checkbox
                    id={`metric-${metric.id}`}
                    checked={selectedMetrics.includes(metric.id)}
                    onCheckedChange={() => handleMetricToggle(metric.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={`metric-${metric.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {metric.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metric.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {selectedMetrics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                <span className="text-sm text-muted-foreground">Selected:</span>
                {selectedMetrics.map(metricId => {
                  const metric = availableMetrics.find(m => m.id === metricId);
                  return (
                    <Badge key={metricId} variant="secondary" className="text-xs">
                      {metric?.label}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Report Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleGenerateReport}
            disabled={generateReportMutation.isPending}
            className="w-full"
            size="lg"
          >
            {generateReportMutation.isPending ? (
              <>
                <DownloadIcon className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <DownloadIcon className="mr-2 h-4 w-4" />
                Generate Performance Report
              </>
            )}
          </Button>
          
          {generateReportMutation.data && (
            <div className="mt-4 p-4 bg-green-50 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-green-900">
                    Report Generated Successfully!
                  </p>
                  <p className="text-sm text-green-700">
                    {generateReportMutation.data.dataExported} records exported
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a 
                    href={generateReportMutation.data.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    Open Sheet
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}