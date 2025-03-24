import { BookOpen, PlayCircle, HeadphonesIcon } from "lucide-react";

export default function HelpSection() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Help & Resources</h2>
      <div className="space-y-4">
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <BookOpen className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Documentation</h3>
              <p className="text-xs text-neutral-300">Read the full user guide</p>
            </div>
          </div>
        </a>
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <PlayCircle className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Video Tutorials</h3>
              <p className="text-xs text-neutral-300">Watch step-by-step guides</p>
            </div>
          </div>
        </a>
        <a href="#" className="block hover:bg-neutral-50 p-3 rounded-md transition-colors">
          <div className="flex items-center">
            <HeadphonesIcon className="text-primary h-5 w-5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-neutral-900">Support</h3>
              <p className="text-xs text-neutral-300">Contact our help team</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
