import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/authConfig";
import { Button } from "@/app/components/ui/button";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

export function LoginPage() {
  const { instance, inProgress } = useMsal();

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const isLoading = inProgress === "login";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-full">
              <ShieldCheck className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Virtual Data Room
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Sign in with your Microsoft account to continue
          </p>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-medium"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Sign in with Microsoft
              </>
            )}
          </Button>

          {/* Security Note */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Secure Authentication
                </h3>
                <p className="text-xs text-blue-700">
                  Your credentials are securely handled by Microsoft. We never store your password.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <p className="mt-6 text-xs text-center text-gray-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
