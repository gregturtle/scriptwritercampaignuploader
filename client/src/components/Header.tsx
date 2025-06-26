import { Button } from "@/components/ui/button";
import { CircleDashed, Upload, Mic } from "lucide-react";
import { Link, useLocation } from "wouter";

interface HeaderProps {
  isAuthenticated: boolean;
  onLogout: () => void;
  onLogin: () => void;
}

export default function Header({ isAuthenticated, onLogout, onLogin }: HeaderProps) {
  const [location] = useLocation();
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <CircleDashed className="h-8 w-8 text-primary" />
              <h1 className="ml-2 text-xl font-semibold text-neutral-900">Meta Campaign Manager</h1>
            </div>
            
            {/* Navigation Tabs */}
            <nav className="flex space-x-1">
              <Link href="/">
                <Button 
                  variant={location === "/" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload</span>
                </Button>
              </Link>
              <Link href="/audio-creative-generator">
                <Button 
                  variant={location === "/audio-creative-generator" ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Mic className="h-4 w-4" />
                  <span>Audio Creative Generator</span>
                </Button>
              </Link>
            </nav>
          </div>
          <div>
            {isAuthenticated ? (
              <div className="flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <span className="h-2 w-2 mr-1 rounded-full bg-green-400"></span>
                  Connected to Meta
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-4 text-primary hover:bg-primary hover:text-white"
                  onClick={onLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm" 
                className="text-primary hover:bg-primary hover:text-white"
                onClick={onLogin}
              >
                Connect to Meta
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
