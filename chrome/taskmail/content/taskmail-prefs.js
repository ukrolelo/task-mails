if (!TASKMAIL)
	var TASKMAIL = {};
if (!TASKMAIL.PREFS)
	TASKMAIL.PREFS = {};
	
TASKMAIL.PREFS = {

	resetReportPrefs : function  () {
	  var hDefaultBranch = Components.classes["@mozilla.org/preferences-service;1"]
	  .getService(Components.interfaces.nsIPrefService).getDefaultBranch("extensions.taskmail.report.");
	  var preferences = ["to","cc","subject","body"];
	  for(var i = 0; i < preferences.length; i++) {
	    try {
	      var strDefault = hDefaultBranch.getCharPref(preferences[i]);
	  		document.getElementById("taskmail_report_" + preferences[i]).value = strDefault;
	    } catch (ex) {}
	  }
	},
	
	loadManual : function (aEvent) {
		var stringbundle = document.getElementById("taskmail-string-bundle");
		var href = stringbundle.getString("docUrl");		
	 	window.opener.openURL(href);
  },
  
	/*
	 * States array [{id, label}].
	 */
	states : new Array(),
	
	getStates : function () {
		var result = new Array();
    
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
    var statesPref = prefs.getComplexValue("extensions.taskmail.states",Components.interfaces.nsIPrefLocalizedString).data;
	
    var statePrefArray = statesPref.split(",");
    for(var index=0; index<statePrefArray.length; index++) {
    	var id         = parseInt(statePrefArray[index].substring(0,statePrefArray[index].indexOf("|")));
    	var stateLabel = statePrefArray[index].substring(statePrefArray[index].indexOf("|")+1);
    	var state = { id : id, label : stateLabel };
    	result.push(state);
    }
    return result;
  },
  
  mStatesListBox : null,
  
  init : function () {
  	if (this.states.length == 0) {
  		this.states = this.getStates();
  	}
    this.mStatesListBox = document.getElementById("taskmail-stateList");
    for (var i = 0; i < this.states.length; ++i)
    {
//	  	var newListItem = document.createElement("listitem");
//		  newListItem.setAttribute("label", this.states[i].label);
//		  var stateItem = document.createElement("listcell");
//		  stateItem.setAttribute("label", this.states[i].label);
//		  newListItem.appendChild(stateItem);
//		  this.mStatesListBox.appendChild(newListItem);
			this.mStatesListBox.appendItem(this.states[i].label);
    }
    this._stringsBundle = document.getElementById("taskmail-string-bundle-prefs");
  },
  
	addState : function () {
		var promptService = 
			     Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
	               .getService(Components.interfaces.nsIPromptService);
		var check = {value: false};
		var input = { value : null };
		var title = this._stringsBundle.getString("addStateTitle");
		var message = this._stringsBundle.getString("statePrompt"); 
		var response = promptService.prompt(null,
		                     title,
		                     message,
		                     input, null, check);
		if (response) {
		  var newListItem = document.createElement("listitem");
			newListItem.setAttribute("label", input.value);
			var stateItem = document.createElement("listcell");
			stateItem.setAttribute("label", input.value);
			newListItem.appendChild(stateItem);
			this.mStatesListBox.appendChild(newListItem);
			var max = -1;
			for(var index=0; index<this.states.length; index++) {
				if (this.states[index].id > max) {
					max = this.states[index].id; 
				}
			}
			var state = { id : max + 1, label : input.value };
			this.states.push(state);
			this._saveStatePref();
		}
	},
    
  editState : function () {
	  var item = this.mStatesListBox.selectedItem;
	  var index = this.mStatesListBox.selectedIndex;
	  if (item) {
	  	var oldState = item.label; 
	    var promptService = 
	         Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
	                   .getService(Components.interfaces.nsIPromptService);
	    var check = {value: false};
	    var input = { value : oldState };
	    var title = this._stringsBundle.getString("editStateTitle");
	    var message = this._stringsBundle.getString("statePrompt");
	    var response = promptService.prompt(null,
	                         title,
	                         message,
	                         input, null, check);
	     if (response) {
	     	var newListItem = document.createElement("listitem");
	  		newListItem.setAttribute("label", input.value);
	  		var stateItem = document.createElement("listcell");
	  		stateItem.setAttribute("label", input.value);
	  		newListItem.appendChild(stateItem);
	  		this.mStatesListBox.replaceChild(newListItem, item);
				this.states[index].label = input.value;
				this._saveStatePref();
				this.mStatesListBox.selectedIndex = index;
	     }
    }
   },
    
	deleteState : function () {
		var index = this.mStatesListBox.selectedIndex; 
	  if (index > -1) {
	  	// empeche de supprimer l'état 'fait' (4).
	  	if (this.states[index].id ==  4) {
	  		var message = this._stringsBundle.getString("canDelete"); 
				alert(message);
	  	} else {
		    this.mStatesListBox.removeChild(this.mStatesListBox.selectedItem);
		    this.states.splice(index, 1);
		    this._saveStatePref();
	  	}
	  }
  },
  
  selectState : function () {
  	// on grise le bouton supprimer l'état si l'état en cours est 'fait' (4).
  	var index = this.mStatesListBox.selectedIndex;
  	if (index >= 0) {
	  	var button = document.getElementById("taskmail-deleteStateButton").disabled = (this.states[index].id == 4);
  	}
  },
    
  upState : function () {
  	var index = this.mStatesListBox.selectedIndex;
  	if (index > 0) {
  		var item  = this.mStatesListBox.removeItemAt(index);
  		this.mStatesListBox.insertItemAt(index - 1, item.getAttribute('label'));
  		this.mStatesListBox.selectedIndex = index - 1;
  		var movedState = this.states[index];
  		this.states[index] =  this.states[index - 1];
  		this.states[index - 1] = movedState;
  		this._saveStatePref();
  	}
  },
  
  downState : function () {
  	var index = this.mStatesListBox.selectedIndex;
  	if (index < this.mStatesListBox.getRowCount() - 1) {
  		var item  = this.mStatesListBox.removeItemAt(index + 1);
  		this.mStatesListBox.insertItemAt(index, item.getAttribute('label'));
  		this.mStatesListBox.selectedIndex = index + 1;
  		var movedState = this.states[index];
  		this.states[index] =  this.states[index + 1];
  		this.states[index + 1] = movedState;
  		this._saveStatePref();
  	}
  },
  
  /**
   * Save pref from this.states. The preferences aren't realy saved until click on OK.
   */
  _saveStatePref : function () {
  	var stateString = this.states.map(function (e) {return e.id + "|" + e.label}).join(",");
	  document.getElementById("taskmail_states").value = stateString;
  },

  _stringsBundle : null 
}