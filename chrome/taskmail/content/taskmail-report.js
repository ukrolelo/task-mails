Components.utils.import("resource:///modules/MailUtils.js");

if (!TASKMAIL.Report)
	TASKMAIL.Report = {};
TASKMAIL.Report = {

  /**
   * Génére un rapport HTML de toutes les tâches visibles.
   * Utilise les préférences.
   */
	composeReport : function () {
		var msgComposeType = Components.interfaces.nsIMsgCompType;
		var msgComposFormat = Components.interfaces.nsIMsgCompFormat;
		var aMsgCompoSrv = Components.classes['@mozilla.org/messengercompose;1'].getService(Components.interfaces.nsIMsgComposeService);
	
		gAccountManager = Components.classes['@mozilla.org/messenger/account-manager;1'].
		getService(Components.interfaces.nsIMsgAccountManager);
	
		var params = Components.classes['@mozilla.org/messengercompose/composeparams;1'].
									createInstance(Components.interfaces.nsIMsgComposeParams);
		if (params) {
			params.type = msgComposeType.Template;
			params.format = Components.interfaces.nsIMsgCompFormat.HTML;
			var composeFields = Components.classes['@mozilla.org/messengercompose/composefields;1'].
			                    createInstance(Components.interfaces.nsIMsgCompFields);
			if (composeFields) {
				var prefs = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService)
				.getBranch("extensions.taskmail.report.");
				prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
				var to = prefs.getCharPref("to");
				var cc = prefs.getCharPref("cc");
				var subject = prefs.getCharPref("subject");
				var templateBody = prefs.getCharPref("body");
				
				var tasks = TASKMAIL.UI.retrieveTasks();
				var content = new TASKMAIL.Content();
				content.tasks = tasks;
				tasks = TASKMAIL.UI.sortTaskList(tasks);					
				if (TASKMAIL.UI.currentOrder.columnId == "") {
					// no sort => Tree
					this.makeContentTree(content, null);
				} else if (TASKMAIL.UI.currentOrder.columnId == "taskmail-taskCreateDateCol"
				           || TASKMAIL.UI.currentOrder.columnId == "taskmail-taskDueDateCol"
				           || TASKMAIL.UI.currentOrder.columnId == "taskmail-taskCompleteDateCol") {
					// Date sorting => flat
					// nothing
				} else {
					// State and Priority sorting => groups
					this.makeContentSort(content);
				}
		  	
				var body = this._getReportBody(content, templateBody);
				
				composeFields.to = to;
				composeFields.cc = cc;
				composeFields.subject = subject;
				composeFields.body = body;
				params.composeFields = composeFields;
				aMsgCompoSrv.OpenComposeWindowWithParams(null, params);
			}
		}
	},

	/**
	 * @param aCurrent.tasks doit être trié par folderURI
	 */
	makeContentTree : function (aCurrent, aParent) {
		// découpe la liste en 3 : celle du folder,  celles des sous folder et celles restante (cibling)
		//                         (0 to currentEnd), (currentEnd + 1 to subTasksEnd), (ciblingStart - aCurrent.tasks.length) 
		var currentEnd = 0;
		var subTasksEnd = 0;
		// cherche la derniere tache du folder courant
		for(var i=0; i<aCurrent.tasks.length-1; i++) {
			var previousFolderURI = aCurrent.tasks[0].folderURI;
			if (previousFolderURI == aCurrent.tasks[i+1].folderURI) {
				currentEnd = i + 1;
			}
		}
		// cherche la derniere tache des sous-folers en parcourant les taches suivantes
		// tant que les taches ont un folderURI qui contient le folderURI du folder courant
		var currentFolderURI = aCurrent.tasks[0].folderURI;
		for(var i=currentEnd + 1; i<aCurrent.tasks.length; i++) {
			if (aCurrent.tasks[i].folderURI.indexOf(currentFolderURI) > -1) {
				// folderURI contient folderURI du folder courant => sous taches.
				subTasksEnd = i;
			}
		}
		if (subTasksEnd != 0) {
			// si on a trouvé des sous-taches, on crée l'arborescence pour ces sous-taches.
			var tmp = new TASKMAIL.Content();
			tmp.tasks = aCurrent.tasks.slice(currentEnd + 1, subTasksEnd + 1);
			aCurrent.subContents.push(tmp);
			this.makeContentTree(tmp, aCurrent);
		}
		// on cherche les taches cibling après les courantes ou les sous-taches.
		var ciblingStart = (subTasksEnd > currentEnd ? subTasksEnd : currentEnd) + 1;
		if (ciblingStart < aCurrent.tasks.length) {
			// il y a des taches après ciblingStart
			var tmp = new TASKMAIL.Content();
			tmp.tasks = aCurrent.tasks.slice(ciblingStart, aCurrent.tasks.length + 1);
			aParent.subContents.push(tmp);
			this.makeContentTree(tmp, aParent);
		}
		// on ne garde que les taches du folder courant.
		// si on n'a que des taches dans le folder courant, currentEnd = length, 
		// le splice ne fera donc rien
		if (aCurrent.tasks.length > currentEnd) {
			aCurrent.tasks.splice(currentEnd + 1,aCurrent.tasks.length);
		}
		if (aCurrent.tasks.length > 0) {
			var prettyName = MailUtils.getFolderForURI(aCurrent.tasks[0].folderURI, false).prettyName;
			aCurrent.folderName = prettyName;
		}
	},
	
	/**
	 * Construit une arbo de Content sous forme de groupe 
	 * pour le tri par état et le tri par priorité
	 * (un seul niveau d'arbo). 
	 * @param aCurrent.tasks doit être trié par folderURI
	 */
	makeContentSort : function (rootContent) {
		var property = null;
		switch (TASKMAIL.UI.currentOrder.columnId) {
			case "taskmail-taskPriorityCol":
				property = "priority";
				break;
			case "taskmail-taskStateCol":
				property = "state";
				break;
//			case "taskmail-taskCreateDateCol":
//				property = "createDate";
//				break;
//			case "taskmail-taskDueDateCol":
//				property = "dueDate";
//				break;
//			case "taskmail-taskCompleteDateCol":
//				property = "completeDate";
//				break;
		}
		while (rootContent.tasks.length > 0) {
			var i = 0;
			while ((i <= rootContent.tasks.length-2) && (rootContent.tasks[i][property] == rootContent.tasks[i+1][property])) {
				i++;
			}
			rootContent.subContents.push(new TASKMAIL.Content());
			var removed = rootContent.tasks.splice(0,i+1);
			rootContent.subContents[rootContent.subContents.length-1].tasks = removed;
			rootContent.subContents[rootContent.subContents.length-1].folderName = removed[0][property];
		}
	},
	
	/**
	 * transforme une arbo de Content en un seul content.
	 */
	makeFlatTaskList : function (temp) {
		for(var i=0; i<temp.subContents.length; i++) {
			var subtemp = this.makeFlatTaskList(temp.subContents[i]);
			temp.tasks = temp.tasks.concat(subtemp.tasks);
		}
		temp.subContents = new Array();
		return temp;
	},
	
	/**
	 * génére la partie du rapport correspondant à une tache.
	 * génere la partie du template qui est entre #TASK# en y substituant les informations.
	 */
	_getReportTask : function (task, templateTask) {
	  var result = templateTask.replace("#TASK_TITLE#",task.title);
	  var stateLabel = TASKMAIL.UI.getStateLabel(task.state);
	  result = result.replace("#TASK_STATE#",stateLabel);
	  result = result.replace("#TASK_DESC#",task.desc);
	  result = result.replace("#TASK_PRIO#",task.priority);
		result = result.replace("#TASK_CREATION_DATE#",   task.createDate   == null ? "" : TASKMAIL.UI.formatDate(task.createDate));
		result = result.replace("#TASK_DUE_DATE#",        task.dueDate      == null ? "" : TASKMAIL.UI.formatDate(task.dueDate));
		result = result.replace("#TASK_COMPLETION_DATE#", task.completeDate == null ? "" : TASKMAIL.UI.formatDate(task.completeDate));
		return result;
	},
	
	/**
	 * génère la partie du rapport correspondant à un folder.
	 * remplace ce qui est entre #TASK# par la liste des taches.
	 * remplace ce qui est entre #SUBTASK# par le contenu recursif des sous folders.
	 */
	_getReportFolder : function (content, templateFolder) {
		
		if (content.tasks.length == 0 && content.subContents.length == 0) {
			return "";
		}
		
	  var templateTask = templateFolder.substring(templateFolder.indexOf("#TASK#") + 6,
	                                            templateFolder.lastIndexOf("#TASK#"));
	  // génère le texte de la liste des taches
	  var reportTasks = "";
	  for(var i = 0; i < content.tasks.length; i++) {
	    reportTasks += this._getReportTask(content.tasks[i], templateTask);
	  }
	  
	  // génère la liste des sous folders
	  var reportSubFolders = "";
	  for (var j = 0; j < content.subContents.length; j++ ) {
	    reportSubFolders += this._getReportFolder(content.subContents[j], templateFolder);
	  }
	  
	  if (content.folderName == "") {
	  	// si le folder n'a pas de label (rootFolder notamment)
	  	// on attaque directement son propre contenu (tasks et subContents)
	  	// faisant ainsi sauter un niveau de <ul> 
	  	var result = reportTasks;
	  	result += reportSubFolders;
	  } else {
		  // remplace dans le template la liste des taches
		  var result = templateFolder.substring(0, templateFolder.indexOf("#TASK#"));
		  result += reportTasks;
		  result += templateFolder.substring(templateFolder.lastIndexOf("#TASK#") + 6);
		    
		  result = result.replace("#SUB_FOLDERS#",reportSubFolders);
		  
			var label = "";
			switch (TASKMAIL.UI.currentOrder.columnId) {
				case "taskmail-taskPriorityCol":
					property = "priority";
					break;
				case "taskmail-taskStateCol":
					property = "state";
					break;
				
			}
			var folderLabel = "";
			switch (TASKMAIL.UI.currentOrder.columnId) {
				case "taskmail-taskPriorityCol":
					folderLabel = TASKMAIL.UI.stringsBundle.getString('reportPriority')
					              + " " + content.folderName;	
					break;
				case "taskmail-taskStateCol":
					folderLabel = TASKMAIL.UI.stringsBundle.getString('reportState')
					               + " " + TASKMAIL.UI.states[content.folderName].label;
					break;
				default:
					folderLabel = content.folderName;	
					break;
			}
		  result = result.replace("#FOLDER_NAME#",folderLabel);
	  }
	  
	  return result;
	},

	/*
	 * Génère le corps du rapport.
	 * Prend tout ce qui est autour des #.
	 */
	_getReportBody : function (temp, templateBody) {
	  var result = templateBody.substring(0, templateBody.indexOf("#FOLDER#"));
	  var templateFolder = templateBody.substring(templateBody.indexOf("#FOLDER#") + 8,
		                                            templateBody.lastIndexOf("#FOLDER#"));
	  
	  result += this._getReportFolder(temp, templateFolder);
	  
	  result += templateBody.substring(templateBody.lastIndexOf("#FOLDER#") + 8);
		return result;
	}	
}

