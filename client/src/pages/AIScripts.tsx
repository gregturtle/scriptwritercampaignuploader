import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, TrendingUp, FileText, Brain, BarChart3, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface ScriptSuggestion {
  title: string;
  content: string;
  reasoning: string;
  targetMetrics: string[];
  audioFile?: string;
  audioUrl?: string;
  error?: string;
}

interface GenerationResponse {
  suggestions: ScriptSuggestion[];
  message: string;
  savedToSheet: boolean;
  voiceGenerated?: boolean;
}

export default function AIScripts() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [tabName, setTabName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<ScriptSuggestion[]>([]);
  const [generationComplete, setGenerationComplete] = useState(false);
  const { toast } = useToast();

  const handleGenerateScripts = async () => {
    if (!spreadsheetId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Google Sheets URL or ID",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-scripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: spreadsheetId.trim(),
          tabName: tabName.trim() || undefined,
          includeVoice: true
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate scripts');
      }

      const result = await response.json();
      setSuggestions(result.suggestions);
      setGenerationComplete(true);

      toast({
        title: "Scripts Generated!",
        description: `Generated ${result.suggestions.length} new script suggestions based on your performance data`,
      });
    } catch (error) {
      console.error('Error generating scripts:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate script suggestions",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatSpreadsheetId = (value: string) => {
    // Extract spreadsheet ID from URL if needed
    const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : value;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Brain className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Script Generator
          </h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Analyze your What3Words campaign performance data to generate optimized video scripts. The AI will identify what works best based on usage scores and suggest new high-performing creative concepts.
        </p>
        <div className="flex justify-center gap-2 mt-4">
          <Link href="/reports">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Back to Reports
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Mode
            </Button>
          </Link>
        </div>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Connect Your Performance Data
          </CardTitle>
          <CardDescription>
            Enter your Google Sheets URL containing performance data with scores and script content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="spreadsheet-id">Google Sheets URL or ID *</Label>
            <Input
              id="spreadsheet-id"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit or just the sheet ID"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tab-name">Tab Name (optional)</Label>
            <Input
              id="tab-name"
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              placeholder="Default: 'Cleansed with BEAP' (uses Column U for scores, Column W for scripts)"
              className="w-full"
            />
          </div>

          <Button 
            onClick={handleGenerateScripts}
            disabled={isGenerating || !spreadsheetId.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Performance Data...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Script Suggestions
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Suggestions */}
      {generationComplete && suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h2 className="text-2xl font-bold">Generated Script Suggestions</h2>
            <Badge variant="secondary" className="ml-2">
              {suggestions.length} suggestions
            </Badge>
          </div>
          
          <div className="grid gap-6">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="flex-1">{suggestion.title}</span>
                    <Badge variant="outline" className="ml-2">
                      Script #{index + 1}
                    </Badge>
                  </CardTitle>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {suggestion.targetMetrics.map((metric, metricIndex) => (
                      <Badge key={metricIndex} variant="secondary" className="text-xs">
                        {metric.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Script Content</Label>
                    <Textarea
                      value={suggestion.content}
                      readOnly
                      className="mt-1 min-h-32 text-sm"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700">AI Analysis & Reasoning</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
                      {suggestion.reasoning}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-800">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Suggestions saved to Google Sheets</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                All generated suggestions have been automatically saved to the "New Scripts" tab (tab 4) in your spreadsheet.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-2">
          <p>1. <strong>Data Analysis:</strong> The AI analyzes your top and bottom performing What3Words creatives based on usage scores</p>
          <p>2. <strong>Pattern Recognition:</strong> Identifies what messaging, hooks, and elements drive high usage scores</p>
          <p>3. <strong>Script Generation:</strong> Creates 5 new What3Words scripts optimized for your best-performing metrics</p>
          <p>4. <strong>Auto-Save:</strong> Suggestions are automatically saved to the "New Scripts" tab (tab 4) in your Google Sheet</p>
        </CardContent>
      </Card>
    </div>
  );
}