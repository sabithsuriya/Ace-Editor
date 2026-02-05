document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById("status");
  const copyToggle = document.getElementById("enableCopy");
  const editToggle = document.getElementById("enableEdit");
  const inputEl = document.getElementById("inputText");
  const runBtn = document.getElementById("run");
  const clearBtn = document.getElementById("clear");

  function setStatus(t) { statusEl.textContent = t; }

  chrome.storage.sync.get({ enableCopy: true, enableEdit: true, lastInput: "" }, function(items) {
    copyToggle.checked = !!items.enableCopy;
    editToggle.checked = !!items.enableEdit;
    inputEl.value = items.lastInput || "";
    setStatus('Ready');
  });

  function applyToActiveTab(message, cb) {
    chrome.tabs.query({active:true,currentWindow:true}, function(tabs){
      if (!tabs || !tabs[0]) {
        setStatus('No active tab');
        if (cb) cb({status:"no_tab"});
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, message, function(response){
        if (chrome.runtime.lastError) {
          setStatus('Error: ' + chrome.runtime.lastError.message);
          if (cb) cb({status:"error", message: chrome.runtime.lastError.message});
        } else {
          // The content script may return an object or result from page script
          setStatus(response && response.message ? response.message : JSON.stringify(response));
          if (cb) cb(response);
        }
      });
    });
  }

  copyToggle.addEventListener('change', function() {
    const enabled = copyToggle.checked;
    chrome.storage.sync.set({ enableCopy: enabled }, function() {
      if (enabled) {
        applyToActiveTab({ type: 'enable_copy' }, function(res) {
          if (res && res.message) {
            setStatus(res.message);
          }
        });
      } else {
        applyToActiveTab({ type: 'disable_copy' });
        setStatus('Copy Mode: OFF');
      }
    });
  });

  editToggle.addEventListener('change', function() {
    const enabled = editToggle.checked;
    chrome.storage.sync.set({ enableEdit: enabled }, function() {
      applyToActiveTab({ type: 'enable_edit', enabled: enabled });
    });
  });

  runBtn.addEventListener('click', function() {
    const text = inputEl.value || "";
    chrome.storage.sync.set({ lastInput: text }, function() {
      setStatus('Running ACE injection...');
      applyToActiveTab({ type: 'run_ace', inputText: text }, function(res){
        // res might be the direct result from page script delivered by content script
        try {
          if (res && res.status) {
            setStatus(res.message || res.status);
          } else {
            setStatus(JSON.stringify(res));
          }
        } catch(e) {
          setStatus('Done');
        }
      });
    });
  });

  clearBtn.addEventListener('click', function() {
    inputEl.value = '';
    chrome.storage.sync.remove('lastInput', function() {
      setStatus('Cleared');
    });
  });
});