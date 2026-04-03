import { Configuration, PopupRequest } from "@azure/msal-browser";

/**
 * Configuration object to be passed to MSAL instance on creation
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: "YOUR_CLIENT_ID_HERE", // Replace with your Azure AD app's client ID
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID_HERE", // Replace with your tenant ID or "common"
    redirectUri: window.location.origin, // This will be the current page URL
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export const loginRequest: PopupRequest = {
  scopes: ["User.Read"], // Add any additional scopes your API requires
};

/**
 * Add the endpoints and scopes when obtaining an access token for protected web APIs.
 * For more information, see:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/resources-and-scopes.md
 */
export const apiConfig = {
  scopes: ["User.Read"], // Scopes needed for your API calls
};
