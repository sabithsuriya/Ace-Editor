(function() {
  // Utility: inject script into page context and optionally wait for a response via postMessage
  function injectScriptAndWait(code, expectReply, callback) {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.textContent = code;
    document.documentElement.appendChild(script);
    // remove script tag after execution
    setTimeout(function(){ script.parentNode && script.parentNode.removeChild(script); }, 50);

    if (!expectReply) {
      callback && callback({status: "injected"});
      return;
    }

    // Listen for a one-time postMessage reply from the page script
    function handler(event) {
      try {
        if (event.source !== window) return;
        var d = event.data;
        if (!d || d.__skillrack_injection__ !== true) return;
        window.removeEventListener('message', handler);
        callback && callback(d.result);
      } catch (e) {
        window.removeEventListener('message', handler);
        callback && callback({status: "error", message: String(e)});
      }
    }
    window.addEventListener('message', handler);
    // fallback timeout after 2s
    setTimeout(function(){
      try {
        window.removeEventListener('message', handler);
      } catch(e) {}
      callback && callback({status: "timeout", message: "No response from page script."});
    }, 2000);
  }

  function enableCopyAndContext() {
    try {
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.onmousedown = null;
      document.onmouseup = null;
      document.oncopy = null;
      document.oncut = null;
      document.onpaste = null;
      var all = document.querySelectorAll('*');
      for (var i=0;i<all.length;i++){
        try {
          all[i].oncontextmenu = null;
          all[i].onselectstart = null;
          all[i].onmousedown = null;
          all[i].onmouseup = null;
          all[i].oncopy = null;
          all[i].oncut = null;
          all[i].onpaste = null;
        } catch(e){}
      }
      (function(){
        var orig = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function(type, listener, opts) {
          if (type === 'contextmenu' || type === 'selectstart' || type === 'copy' || type === 'cut' || type === 'paste') {
            return;
          }
          return orig.call(this, type, listener, opts);
        };
      })();
      var css = document.createElement('style');
      css.id = "skillrack-enable-select-style";
      css.type = "text/css";
      css.appendChild(document.createTextNode('* { -webkit-user-select: text !important; -moz-user-select: text !important; user-select: text !important; }'));
      document.head && document.head.appendChild(css);
      return {status: "ok", message: "Copy and selection enabled."};
    } catch (err) {
      return {status: "error", message: String(err)};
    }
  }

  function disableCopy() {
    try {
      var css = document.getElementById('skillrack-enable-select-style');
      if (css && css.parentNode) css.parentNode.removeChild(css);
      return {status:"ok", message:"Copy enhancements removed (cannot restore original handlers)."};
    } catch(e){
      return {status:"error", message:String(e)};
    }
  }

  function setEditingEnabled(enabled) {
    try {
      document.body.contentEditable = enabled ? "true" : "false";
      try { document.designMode = enabled ? "on" : "off"; } catch(e){}
      return {status:"ok", message: "Editing " + (enabled ? "enabled" : "disabled")};
    } catch (err) {
      return {status: "error", message: String(err)};
    }
  }

  // This function injects a page-script that runs in page context to access window.ace and ace editors.
  function runAceInsertion_viaPageContext(inputText, callback) {
    var payload = { input: inputText };
    // We'll serialize using JSON.stringify to be safe
    var serialized = JSON.stringify(payload);
    var code = "(function(payloadJson){\n" +
               "  try{\n" +
               "    var payload = JSON.parse(payloadJson);\n" +
               "    var input = String(payload.input||'');\n" +
               "    var editorEl = document.querySelector('.ace_editor.ace_dark') || document.querySelector('.ace_editor');\n" +
               "    if(!editorEl){\n" +
               "      window.postMessage({__skillrack_injection__:true, result: {status:'no_editor', message:'No .ace_editor element found.'}}, '*');\n" +
               "      return;\n" +
               "    }\n" +
               "    if(typeof window.ace === 'undefined'){\n" +
               "      window.postMessage({__skillrack_injection__:true, result: {status:'no_ace', message:'ACE library (window.ace) not found on the page.'}}, '*');\n" +
               "      return;\n" +
               "    }\n" +
               "    try{\n" +
               "      var id = editorEl.id;\n" +
               "      if(!id){ id = 'skillrack_ace_' + Math.random().toString(36).slice(2); editorEl.id = id; }\n" +
               "      var editor = window.ace.edit(id);\n" +
               "      if(!editor){ throw new Error('ace.edit returned falsy'); }\n" +
               "      // Build CODE string and insert words like original snippet\n" +
               "      var CODE = input;\n" +
               "      var X = CODE.split(' ');\n" +
               "      editor.setValue('');\n" +
               "      for(var i=0;i<X.length;i++){\n" +
               "        editor.insert(X[i] + (i<X.length-1 ? ' ' : ''));\n" +
               "      }\n" +
               "      window.postMessage({__skillrack_injection__:true, result: {status:'ok', message:'Inserted into ACE editor.'}}, '*');\n" +
               "    }catch(e){\n" +
               "      window.postMessage({__skillrack_injection__:true, result: {status:'error', message: String(e)}}, '*');\n" +
               "    }\n" +
               "  }catch(e){\n" +
               "    window.postMessage({__skillrack_injection__:true, result: {status:'error', message: String(e)}}, '*');\n" +
               "  }\n" +
               "})( " + JSON.stringify(serialized) + " );";

    injectScriptAndWait(code, true, callback);
  }

  // Apply stored settings on load
  try {
    if (chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ enableCopy: true, enableEdit: false }, function(items) {
        if (items.enableCopy) {
          enableCopyAndContext();
        }
        setEditingEnabled(!!items.enableEdit);
      });
    }
  } catch(e){}

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!request || !request.type) return;
    if (request.type === 'enable_copy') {
      var res = enableCopyAndContext();
      sendResponse(res);
    } else if (request.type === 'disable_copy') {
      var res = disableCopy();
      sendResponse(res);
    } else if (request.type === 'enable_edit') {
      var res = setEditingEnabled(!!request.enabled);
      sendResponse(res);
    } else if (request.type === 'run_ace') {
      // Run injection into page context and wait for result
      runAceInsertion_viaPageContext(request.inputText || "", function(result){
        // result is the object posted from page script
        sendResponse(result);
      });
      // Indicate asynchronous response
      return true;
    }
    return true;
  });
})();