if (!TASKMAIL)
	var TASKMAIL = {};
if (!TASKMAIL.COLUMN)
	TASKMAIL.COLUMN = {};

TASKMAIL.COLUMN = {
	doOnceLoaded : function () {
	  var ObserverService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
	  ObserverService.addObserver(this.CreateDbObserver, "MsgCreateDBView", false);
	},
	CreateDbObserver : {
	  // Components.interfaces.nsIObserver
	  observe: function(aMsgFolder, aTopic, aData)
	  {  
     	TASKMAIL.COLUMN.addCustomColumnHandler();
  	}
	},
	columnHandler : {
	  isString:            function() {return true;},
	
	  getCellText:         function(row, col) {
	    return null;
	  },
	
	  getCellProperties:   function(row, col, props){},
	
	  getRowProperties:    function(row, props){},
	
	  getImageSrc:         function(row, col) {
	    var selectedTaskKeys = TASKMAIL.UI.getSelectedTasksKeys();
	    var mailKey = gDBView.getKeyAt(row);
	    var type = 0;
    	type = TASKMAIL.Link.getMailLinkType(selectedTaskKeys, gDBView.msgFolder.URI, mailKey);
	    var linkURI = null;
	    if (type == 3) {
	    	linkURI = "chrome://taskmail/skin/link_task_grey.png";
	    } else if (type == 2) {
	    	linkURI = "chrome://taskmail/skin/link_task_hilight.png";
	    } else if (type == 1) {
	    	linkURI = "chrome://taskmail/skin/link_task.png";
	    }
	    //TASKMAIL.log("getImageSrc:mailKey="+mailKey+",selectedTaskKeys="+selectedTaskKeys+",result="+linkURI);
	  	return linkURI;
	  },
	
	  getSortLongForRow:   function(hdr) {return 0;},
	
	  getSortStringForRow: function(hdr) {     
	    var key = gDBView.getKeyAt(row);
	    var hdr = gDBView.db.GetMsgHdrForKey(key);
	    var messageID = hdr.messageId;
		  return hasTask(messageID);
	  }
	},
	
	addCustomColumnHandler : function () {
  	gDBView.addColumnHandler("taskmail-colTask", this.columnHandler);
  }
}

window.addEventListener("load", function(e) {
			TASKMAIL.COLUMN.doOnceLoaded(e);
		}, false);


