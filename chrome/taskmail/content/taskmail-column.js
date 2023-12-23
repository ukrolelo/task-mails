// JavaScript Document

var columnHandler = {
  isString:            function() {return true;},

  getCellText:         function(row, col) {
    return null;
  },

  getCellProperties:   function(row, col, props){},

  getRowProperties:    function(row, props){},

  getImageSrc:         function(row, col) {
  	var taskID = -1;
    var taskSelectedItem = document.getElementById("taskList").selectedItem; 
    if (taskSelectedItem != null) {
      taskID = taskSelectedItem.getAttribute("pk");
    }
    var mailKey = gDBView.getKeyAt(row);
    var type = getMailLinkType(taskID, mailKey);
    var linkURI = null;
    if (type == 2) {
    	linkURI = "chrome://taskmail/skin/link_task_hilight.png";
    } else if (type == 1) {
    	linkURI = "chrome://taskmail/skin/link_task.png";
    }
  	return linkURI;
  },

  getSortLongForRow:   function(hdr) {return 0;},

  getSortStringForRow: function(hdr) {     
    var key = gDBView.getKeyAt(row);
    var hdr = gDBView.db.GetMsgHdrForKey(key);
    var messageID = hdr.messageId;
	  return hasTask(messageID);
  }
}

window.addEventListener("load", doOnceLoaded, false);

function doOnceLoaded() {
  var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  ObserverService.addObserver(CreateDbObserver, "MsgCreateDBView", false);
}

var CreateDbObserver = {
  // Components.interfaces.nsIObserver
  observe: function(aMsgFolder, aTopic, aData)
  {  
     addCustomColumnHandler();
  }
}

function addCustomColumnHandler() {
   gDBView.addColumnHandler("colTask", columnHandler);
}
