console.log("Ace Editor extension background loaded (v1.4).");

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    console.log('Ace Editor extension installed');
  }
});