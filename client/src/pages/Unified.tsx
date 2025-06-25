import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Zap, Calendar, ExternalLink, BarChart3, Brain, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { useCampaigns } from '@/hooks/useCampaigns';

interface UnifiedResult {
  reportResult: {
    spreadsheetId: string;
    spreadsheetUrl: string;
    dataExported: number;
    dateRange: { since: string; until: string };
    createdNew: boolean;
  };
  scriptResult: {
    suggestions: Array<{
      title: string;
      content: string;
      reasoning: string;
      targetMetrics: string[];
    }>;
    message: string;
    savedToSheet: boolean;
  };
}

export default function Unified() {
  const [dateRange, setDateRange] = useState('last_7_days');
  const [customSince, setCustomSince] = useState('');
  const [customUntil, setCustomUntil] = useState('');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<UnifiedResult | null>(null);

  const { toast } = useToast();
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();

  const datePresets = {
    'last_7_days': { label: 'Last 7 days', since: '2025-06-18', until: '2025-06-25' },
    'last_30_days': { label: 'Last 30 days', since: '2025-05-26', until: '2025-06-25' },
    'last_90_days': { label: 'Last 90 days', since: '2025-03-27', until: '2025-06-25' },
    'custom': { label: 'Custom range', since: customSince, until: customUntil }
  };

  const handleCampaignToggle = (campaignId: string) => {
    setSelectedCampaigns(prev => 
      prev.includes(campaignId) 
        ? prev.filter(id => id !== campaignId)
        : [...prev, campaignId]
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedCampaigns(selected ? campaigns.map(c => c.id) : []);
  };

  const handleGenerate = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a Google Sheets URL or ID",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const selectedDateRange = datePresets[dateRange as keyof typeof datePresets];
      
      // Step 1: Generate performance report
      const reportResponse = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRange: {
            since: selectedDateRange.since,
            until: selectedDateRange.until
          },
          campaignIds: selectedCampaigns.length > 0 ? selectedCampaigns : undefined,
          spreadsheetId: spreadsheetId.trim()
        })
      });

      if (!reportResponse.ok) {
        throw new Error('Failed to generate performance report');
      }

      const reportResult = await reportResponse.json();

      // Step 2: Generate AI scripts using the same spreadsheet
      const scriptResponse = await fetch('/api/ai/generate-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: reportResult.spreadsheetId || spreadsheetId.trim(),
          tabName: 'Cleansed with BEAP'
        })
      });

      if (!scriptResponse.ok) {
        throw new Error('Failed to generate AI scripts');
      }

      const scriptResult = await scriptResponse.json();

      setResult({
        reportResult,
        scriptResult
      });

      toast({
        title: "Complete Success!",
        description: `Generated report with ${reportResult.dataExported} records and ${scriptResult.suggestions.length} AI script suggestions`,
      });

    } catch (error) {
      console.error('Error in unified generation:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Unified Report & Script Generator
          </h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Generate performance reports and AI script suggestions in one streamlined workflow. Select your campaigns, provide your Google Sheets URL, and get both reports and optimized scripts automatically.
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Link href="/reports">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports Only
            </Button>
          </Link>
          <Link href="/ai-scripts">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Scripts Only
            </Button>
          </Link>
        </div>
      </div>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configuration
          </CardTitle>
          <CardDescription>
            Configure your report parameters and Google Sheets destination
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range Selection */}
          <div className="space-y-2">
            <Label htmlFor="date-range">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(datePresets).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="since">Start Date</Label>
                <Input
                  id="since"
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="until">End Date</Label>
                <Input
                  id="until"
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Campaign Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Campaign Selection</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                  disabled={campaignsLoading}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading campaigns...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-4">
                {campaigns.map((campaign) => (
                  <label key={campaign.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCampaigns.includes(campaign.id)}
                      onChange={() => handleCampaignToggle(campaign.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm truncate">{campaign.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500">
              {selectedCampaigns.length === 0 ? 'All campaigns will be included' : `${selectedCampaigns.length} campaigns selected`}
            </p>
          </div>

          {/* Google Sheets URL */}
          <div className="space-y-2">
            <Label htmlFor="spreadsheet">Google Sheets URL or ID</Label>
            <Input
              id="spreadsheet"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit or just the sheet ID"
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report & Scripts...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Generate Report & AI Scripts
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Success Summary */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800 mb-4">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium text-lg">Generation Complete!</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Performance Report:</span>
                  <p>{result.reportResult.dataExported} records exported</p>
                  <p>Date range: {result.reportResult.dateRange.since} to {result.reportResult.dateRange.until}</p>
                </div>
                <div>
                  <span className="font-medium">AI Scripts:</span>
                  <p>{result.scriptResult.suggestions.length} script suggestions generated</p>
                  <p>Saved to "New Scripts" tab</p>
                </div>
              </div>
              <div className="mt-4">
                <a
                  href={result.reportResult.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Google Sheets
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Script Suggestions Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Script Suggestions</CardTitle>
              <CardDescription>
                AI-generated voiceover scripts based on your performance data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.scriptResult.suggestions.map((suggestion, index) => (
                  <Card key={index} className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <h4 className="font-medium text-blue-900 mb-2">{suggestion.title}</h4>
                      <p className="text-sm text-gray-700 mb-3 italic">"{suggestion.content}"</p>
                      <p className="text-xs text-blue-700">{suggestion.reasoning}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {suggestion.targetMetrics.map((metric) => (
                          <span key={metric} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {metric}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}