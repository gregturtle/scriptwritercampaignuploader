import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AuthResponse {
  authenticated: boolean;
}

export function useMetaAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status
  const { data: authStatus } = useQuery({
    queryKey: ['/api/auth/status'],
    retry: false,
    onSuccess: (data: any) => {
      const authState = !!data?.authenticated;
      setIsAuthenticated(authState);
      
      // If authenticated, trigger campaign fetching
      if (authState) {
        queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      }
    },
    onSettled: (_data, error) => {
      if (error) {
        setIsAuthenticated(false);
      }
    }
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/auth/login-url', undefined);
      const data = await response.json();
      if (data.url) {
        // Open the Meta login page in a popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2.5;
        const popup = window.open(
          data.url,
          'meta-auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Check if the popup is still open
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            // Refresh auth status
            queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
          }
        }, 1000);
      }
      return data;
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout', undefined);
      return response.json();
    },
    onSuccess: () => {
      setIsAuthenticated(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
    }
  });

  const login = () => {
    loginMutation.mutate();
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  return {
    isAuthenticated,
    isLoading: loginMutation.isPending || logoutMutation.isPending,
    login,
    logout
  };
}
