console.log("SkillRack extension background loaded (v1.3).");

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    console.log('SkillRack extension installed');
  }
});