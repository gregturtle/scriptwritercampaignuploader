import { BookOpen, PlayCircle, HeadphonesIcon, Smartphone, AlertTriangle, Info, ExternalLink, FileVideo } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function HelpSection() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Help & Resources</h2>
      
      {/* Campaign Type Information */}
      <div className="mb-5 p-3 bg-blue-50 rounded-md border border-blue-100">
        <div className="flex items-start mb-2">
          <Smartphone className="text-blue-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-blue-900">App Install Campaigns</h3>
        </div>
        <p className="text-xs text-blue-700 ml-7 mb-2">
          This app supports App Install/Promotion campaigns. Videos uploaded to these campaigns 
          will automatically use the "Install Mobile App" call-to-action with your registered Meta app.
        </p>
        <Accordion type="single" collapsible className="ml-7">
          <AccordionItem value="app-install-details" className="border-blue-200">
            <AccordionTrigger className="text-xs text-blue-800 py-1 hover:no-underline hover:text-blue-900">
              App Install Campaign Details
            </AccordionTrigger>
            <AccordionContent className="text-xs text-blue-700">
              <ul className="list-disc pl-4 space-y-1">
                <li>Works with campaign objectives: "APP_INSTALLS" or "OUTCOME_APP_PROMOTION"</li>
                <li>Requires an app registered in Meta's App Dashboard</li>
                <li>Automatically sets call-to-action to "INSTALL_MOBILE_APP"</li>
                <li>Includes app store links in the ad creative</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
      
      {/* Standard Campaigns */}
      <div className="mb-5 p-3 bg-green-50 rounded-md border border-green-100">
        <div className="flex items-start mb-2">
          <ExternalLink className="text-green-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-green-900">Standard Campaigns</h3>
        </div>
        <p className="text-xs text-green-700 ml-7">
          Standard campaigns (Traffic, Conversions, etc.) will use your video creative with the default 
          campaign settings and call-to-action.
        </p>
      </div>
      
      {/* Video Requirements */}
      <div className="mb-5 p-3 bg-indigo-50 rounded-md border border-indigo-100">
        <div className="flex items-start mb-2">
          <FileVideo className="text-indigo-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-indigo-900">Video Requirements</h3>
        </div>
        <ul className="text-xs text-indigo-700 ml-7 list-disc space-y-1 pl-3">
          <li>Supported format: .mov video files</li>
          <li>Recommended aspect ratios: 16:9, 9:16 (vertical), or 1:1 (square)</li>
          <li>Maximum file size: 4GB</li>
          <li>Maximum length: 120 seconds (shorter videos perform better)</li>
        </ul>
      </div>
      
      {/* Important Requirements */}
      <div className="mb-5 p-3 bg-amber-50 rounded-md border border-amber-100">
        <div className="flex items-start mb-2">
          <AlertTriangle className="text-amber-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-amber-900">Important Requirements</h3>
        </div>
        <ul className="text-xs text-amber-700 ml-7 list-disc space-y-1 pl-3">
          <li><strong>A real Facebook Page</strong> (test pages won't work for launching ads)</li>
          <li>For App Install campaigns: A registered app in Meta</li>
          <li>Valid access token with ads_management permission</li>
          <li>An active ad account with billing set up</li>
        </ul>
      </div>
      
      <div className="space-y-3">
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <BookOpen className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Documentation</h3>
              <p className="text-xs text-neutral-500">Read the full user guide</p>
            </div>
          </div>
        </a>
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <PlayCircle className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Video Tutorials</h3>
              <p className="text-xs text-neutral-500">Watch step-by-step guides</p>
            </div>
          </div>
        </a>
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <Smartphone className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">App Setup Guide</h3>
              <p className="text-xs text-neutral-500">Learn how to register your app with Meta</p>
            </div>
          </div>
        </a>
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <HeadphonesIcon className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Support</h3>
              <p className="text-xs text-neutral-500">Contact our help team</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
