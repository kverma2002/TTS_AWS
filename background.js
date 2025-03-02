console.log("Content script loaded for TTS extension.");
console.log(chrome.identity.getRedirectURL());

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "awsTTS",
      title: "Speak Text",
      contexts: ["selection"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "awsTTS") {
      const selectedText = info.selectionText;
      chrome.tabs.sendMessage(tab.id, { action: "speakText", text: selectedText }, (response) => {
        console.log("Received response:", response);
        if (chrome.runtime.lastError) {
          console.warn("Content script not available in this tab.");
        }
      });
    }
  });
  