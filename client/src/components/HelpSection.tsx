import { BookOpen, PlayCircle, HeadphonesIcon, Smartphone, AlertTriangle, Info } from "lucide-react";

export default function HelpSection() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Help & Resources</h2>
      
      {/* Campaign Type Information */}
      <div className="mb-5 p-3 bg-blue-50 rounded-md border border-blue-100">
        <div className="flex items-start mb-2">
          <Info className="text-blue-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-blue-900">App Install Campaigns</h3>
        </div>
        <p className="text-xs text-blue-700 ml-7">
          This app now supports App Install/Promotion campaigns. Videos uploaded to these campaigns 
          will automatically use the "Install Mobile App" call-to-action with your registered Meta app.
        </p>
      </div>
      
      {/* Important Requirements */}
      <div className="mb-5 p-3 bg-amber-50 rounded-md border border-amber-100">
        <div className="flex items-start mb-2">
          <AlertTriangle className="text-amber-600 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-medium text-amber-900">Important Requirements</h3>
        </div>
        <ul className="text-xs text-amber-700 ml-7 list-disc space-y-1 pl-3">
          <li>A real Facebook Page (test pages won't work)</li>
          <li>For App Install campaigns: A registered app in Meta</li>
          <li>Valid access token with ads_management permission</li>
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
