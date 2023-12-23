Components.utils.import("resource:///modules/MailUtils.js");

if (!TASKMAIL)
	var TASKMAIL = {};
if (!TASKMAIL.UI)
	TASKMAIL.UI = {};

TASKMAIL.UI = {
	
	/**
	 * Open detail
	 */
	doubleClikTask : function(event) {
		var box = document.getElementById("taskmail-addTask");
		var selectedTask = TASKMAIL.UI.getSelectedTasks();
		if (box.collapsed || this.taskDetailPK != selectedTask[0].id) {
			// si on double clique sur une autre tache, ça l'ouvre
			this.beginUpdateTask();
		} else {
			this.cancelSaveTask();
		}
	},

	beginAddTaskWithLink : function() {
		this.beginAddTask("message");
		// addWithLink après pour overrider
		this.addWithLink = true;
		var box = document.getElementById("taskmail-detail-splitter").setAttribute("state","open");
	},

	/**
	 * @return Task A new task initialised with the current message. subject becomes title 
	 * 				 and current selection becomes description. Is no message selected returns 
	 * 				 new default Task. 
	 */
	newTaskFromMessage : function () {
		var mails = gFolderDisplay.selectedMessages;
		var doc = document.getElementById("messagepane").contentDocument;
		var selection = doc.getSelection();
		var title = mails.length == 1 ? mails[0].mime2DecodedSubject : null;
		// With Thunderbird Conversation, selection is null.
		var desc = selection != null && selection != "" ? selection.toString() : null;
		var task = new TASKMAIL.Task(0, null, null, title, desc, 1, 5, null, null, null);
		return task;
	},

	/**
	 * @param defaultValue String "empty" to make a new empty task and "message" to use current message
	 */
	beginAddTask : function(defaultValue) {
		// clean UI
		var newTask = null;
		if (defaultValue == "message") {
			newTask = this.newTaskFromMessage();
		} else {
			newTask = new TASKMAIL.Task(0, null, null, null, null, 1, 5, null, null, null);
		}
		this.fillTaskDetail(newTask);
		var box = document.getElementById("taskmail-detail-splitter");
		box.setAttribute("state","open");
		document.getElementById("taskmail-taskTitle").focus();
		this.taskDetailPK = -1;
		this.addWithLink = false;
		document.getElementById("taskmail-splitter").setAttribute("state","open");
	},

	/*
	 * Update la tache (la 1° sélectionnée)
	 */
	beginUpdateTask : function() {
		// get task detail
		var taskKeys = this.getSelectedTasksKeys();
		if (taskKeys.length > 0) {
			// on prend la 1° tache sélectionnée
			var task = TASKMAIL.DB.getTaskDetailSQLite(taskKeys[0]);
			this.fillTaskDetail(task);
			// show details
			var box = document.getElementById("taskmail-detail-splitter");
			box.setAttribute("state","open");
			document.getElementById("taskmail-taskTitle").focus();
			this.taskDetailPK = taskKeys[0];
		}
	},

	/**
	 * returns a Date (objcet) if Lighting is installed or not.
	 * @param anId String an dom id
	 * @return Date 
	 */
	getDate : function (anId) {
	  var result = null;
	  if (anId == "taskmail-taskCreateDate" || document.getElementById(anId + "Chk").checked) {
		  result = document.getElementById(anId).value;
		  if (typeof result != "object") {
			  // when lightning is not installed (value returns a string and 
			  // not an object)
			  result = document.getElementById(anId).dateValue;
		  }
	  }
	  return result;
  },
  
  saveTask : function() {
		var idInput = document.getElementById("taskmail-addTask").value;
		var titleInput = document.getElementById("taskmail-taskTitle").value;
		var stateInput = document.getElementById("taskmail-taskState").selectedItem.value;
		var desc = document.getElementById("taskmail-taskDesc").value;
		var prio = document.getElementById("taskmail-taskPriority").selectedIndex;
		var createDate   = this.getDate("taskmail-taskCreateDate");
		var dueDate      = this.getDate("taskmail-taskDueDate");
		var completeDate = this.getDate("taskmail-taskCompleteDate");
		// always save task into current folder.
		var currentMsgFolder = GetSelectedMsgFolders()[0];

		if (this.taskDetailPK == -1) {
			TASKMAIL.DB.addTaskSQLite(new TASKMAIL.Task(idInput,
					currentMsgFolder.URI, currentMsgFolder.prettyName, titleInput, desc, stateInput,
					prio, createDate, dueDate, completeDate));
			if (this.addWithLink) {
				var taskId = TASKMAIL.DB.dbConnection.lastInsertRowID;
				var selectedMessages = gFolderDisplay.selectedMessages;
				for (var i = 0; i < selectedMessages.length; i++) {
					TASKMAIL.DB.linkTaskSQLite(taskId, selectedMessages[i]);
				}
			}
		} else {
			TASKMAIL.DB.updateTaskSQLite(new TASKMAIL.Task(idInput, null, null,
					titleInput, desc, stateInput, prio, createDate, dueDate, completeDate));
		}
		this.refreshTaskList();
		this.cancelSaveTask();
	},

	cancelSaveTask : function() {
		var box = document.getElementById("taskmail-detail-splitter");
		box.setAttribute("state","collapsed");
	},

	/**
	 * efface toutes les tâches sélectionnées avec les liens associés
	 */
	removeTask : function() {
		// demande une confirmation
		if (window.confirm(TASKMAIL.UI.stringsBundle
				.getString('taskDeleteConfirm'))) {
			var taskIds = this.getSelectedTasksKeys();
			for (var i = 0; i < taskIds.length; i++) {
				TASKMAIL.DB.removeTaskAndLinkSQLite(taskIds[i]);
				// ferme le détail de tâche si ouverte
				if (this.taskDetailPK == taskIds[i])
					this.cancelSaveTask();
			}
			this.refreshTaskList();
			this.onTaskSelect();
		}
	},

	/**
	 * déplace les taches dans un nouveau folder.
	 */
	moveTask : function(aDestFolder) {
		var tasks = TASKMAIL.UI.getSelectedTasksKeys();
		for (var i = 0; i < tasks.length; i++) {
			TASKMAIL.DB.taskMoveSQLite(tasks[i], aDestFolder);
		}
		if (tasks.length > 0) {
			TASKMAIL.UI.refreshTaskList();
		}
	},

	/**
	 * provoque la sauvegarde de la tache ou son annulation uniquement si le
	 * focus est dans le datail de la tache
	 * 
	 * @param action
	 *            taskDetailKey:
	 */
	keyPressedInTaskDetail : function(action) {
		var focused = document.commandDispatcher.focusedElement;
		while (focused.id == "taskmail-addTask" || focused.parentNode != null) {
			if (focused.id == "taskmail-addTask") {
				if (action == "save") {
					this.saveTask();
				} else {
					this.cancelSaveTask();
				}
				break;
			}
			focused = focused.parentNode;
		}
	},

	/**
	 * put linked objects count.
	 * @param sens String "task" (vers email) or "mail" (vers task) or null
	 */
	adjustContextMenu : function(sens) {
		var menuitem = null;
		var linkedObject = null;
		if (sens == "task") {
			var selectedTask = TASKMAIL.UI.getSelectedTasks();
			if (selectedTask.length > 0) {
				linkedObject = TASKMAIL.Link
						.getMailKeysFromTaskID(selectedTask[0].id);
			}
			menuitem = document.getElementById('taskmail-row-menu-goNextMail');
			menuitem.disabled = selectedTask.length != 1;

			// on regarde juste s'il y a un lien et pas si c'est un lien avec le folder courant.
			menuitem = document.getElementById('taskmail-row-menu.selectMail');
			menuitem.disabled = selectedTask.length < 1;
		} else {
			menuitem = document.getElementById('taskmail-mailContext.goNextTask');
			// TODO obtenir email ayant reçu click droit.
			var mails = gFolderDisplay.selectedMessages;
			linkedObject = TASKMAIL.Link
					.getTaskIDFromMailID(mails[0].folder.URI, mails[0].messageKey);
			menuitem.disabled = mails.length != 1;
		}

		if (sens == "task") {
			// on désactive 'go to folder' si la tache courante est dans le
			// folder courant.
			var currentFolder = GetSelectedMsgFolders()[0];
			var selectedTask = TASKMAIL.UI.getSelectedTasks();
			menuitem = document.getElementById('taskmail-row-menu.goFolder');
			if (selectedTask.length == 1) {
				var taskFolderURI = selectedTask[0].folderURI;
				menuitem.disabled = currentFolder.URI == taskFolderURI;
			} else {
				menuitem.disabled = true;
			}
		}
	},
	
	/**
	 * disable update and delete task depending selected task.
	 * change select linked object menu label. 
	 */
	adjustEditMenu : function () {
		var menuitem = document.getElementById('taskmail-menu.deleteTask');
		var selectedTask = this.getSelectedTasks();
		menuitem.disabled = selectedTask.length == 0;
		menuitem = document.getElementById('taskmail-menu.updateTask');
		menuitem.disabled = selectedTask.length != 1;

		menuitem = document.getElementById('taskmail-menu-selectLinked');
		var focused = document.commandDispatcher.focusedElement;
		var dynaLabel = "";
		var dynaDisbled = false;
		if (document.getElementById("taskmail-taskList") == focused) {
			dynaLabel = this.stringsBundle.getString('menuSelectLinkedMail');
			var currentFolder = GetSelectedMsgFolders()[0];
			dynaDisbled = selectedTask.length < 1;
		} else if (document.getElementById("threadTree") == focused) {
			dynaLabel = this.stringsBundle.getString('menuSelectLinkedTask');
			dynaDisbled = false;
		} else {
			dynaLabel = this.stringsBundle.getString('menuSelectLinkedTaskMail');
			dynaDisbled = true;
		} 
		TASKMAIL.log(dynaLabel);
		menuitem.label = dynaLabel;
		menuitem.setAttribute("disabled",dynaDisbled);
	},
	
	/**
	 * check 'view task pane' 
	 */
	adjustViewMenu : function (){
		var menuitem = document.getElementById('taskmail-menu.viewTaskPane');
		var pane = document.getElementById("taskmail-splitter");
		var state = pane.getAttribute("state") == "open";
		menuitem.setAttribute("checked", state);
	},
	
	/**
	 * adjust and disable 'Go to next ...' depending of focus.
	 */
	adjustGoMenu : function (){
		var menuitem = document.getElementById('taskmail-menu-goNextMail');
		var focused = document.commandDispatcher.focusedElement;
		var dynaLabel = "";
		var dynaDisbled = false;
		if (document.getElementById("taskmail-taskList") == focused) {
			dynaLabel = this.stringsBundle.getString('menuGoNextMail');
			var selectedTask = this.getSelectedTasks();
			dynaDisbled = selectedTask.length != 1;
		} else if (document.getElementById("threadTree") == focused) {
			dynaLabel = this.stringsBundle.getString('menuGoNextTask');
			dynaDisbled = false;
		} else {
			dynaLabel = this.stringsBundle.getString('menuGoNextTaskMail');
			dynaDisbled = true;
		} 
		menuitem.label = dynaLabel;
		menuitem.setAttribute("disabled",dynaDisbled);
	},
	
	/**
	 * disable mark as done, change priority if no task are selected.
	 */
	adjustTaskMenu : function() {
		var menuitemrow = document.getElementById('taskmail-row-menu.markDone');
		var menuitemmenubar = document.getElementById('taskmail-menu.markDone');
		var regExp = new RegExp("{s}");
		var doneLabel = TASKMAIL.UI.states[TASKMAIL.done_state].label;
		menuitemrow.label = menuitemrow.label.replace(regExp, doneLabel);
		menuitemmenubar.label = menuitemmenubar.label.replace(regExp, doneLabel);
		var selected = TASKMAIL.UI.getSelectedTasks();
		var menuitem = document.getElementById('taskmail-menu.markDone');
		menuitem.disabled = selected.length == 0;
		menuitem = document.getElementById('taskmail-menu.changePriority');
		menuitem.disabled = selected.length == 0;
		menuitem = document.getElementById('taskmail-menu.move');
		menuitem.disabled = selected.length == 0;
	},
	
	fillTaskList : function(aTask) {
		var item = document.createElement('treeitem');
		var row = document.createElement('treerow');
		
		row.setAttribute('pk', aTask.id);
		row.setAttribute("folderURI", aTask.folderURI);
		
		// Subfolder icon
		var cell = document.createElement("treecell");
		try {
			if (aTask.folderURI != GetSelectedMsgFolders()[0].URI) {
				cell.setAttribute("properties", 'subfolder');
			}
		} catch (err) {
			// Nothing
		}
		row.appendChild(cell);
		
		// link icon
		cell = document.createElement('treecell');
		row.appendChild(cell);

		// priority
		cell = document.createElement('treecell');
		cell.setAttribute('label', aTask.priority);
		cell.setAttribute("properties", "taskPriority taskPriority" + aTask.priority);
		row.appendChild(cell);

		var stateLabel = this.getStateLabel(aTask.state);
		cell = document.createElement('treecell');
		cell.setAttribute('label', stateLabel);
		row.appendChild(cell);

		cell = document.createElement('treecell');
		cell.setAttribute('label', aTask.title);
		row.appendChild(cell);

		cell = document.createElement('treecell');
		cell.setAttribute('label', this.formatDate(aTask.createDate));
		row.appendChild(cell);

		cell = document.createElement('treecell');
		var date = this.formatDate(aTask.dueDate);
		if (date != null) {
			cell.setAttribute('label', date);
		}		
		if (TASKMAIL.isNext(aTask)) {
			cell.setAttribute("properties", "next-task");
		} else if (TASKMAIL.isOverdue(aTask)) {
			cell.setAttribute("properties", "overdue-task");
		}
		row.appendChild(cell);
		

		cell = document.createElement('treecell');
		date = this.formatDate(aTask.completeDate);
		if (date != null) {
			cell.setAttribute('label', date);
		}
		row.appendChild(cell);

		// folderName
		cell = document.createElement('treecell');
		cell.setAttribute('label', aTask.folderName);
		row.appendChild(cell);
		
		item.appendChild(row);
		document.getElementById("taskmail-taskTreeChild").appendChild(item);
	},

	/**
	 * Fill a date field even if lightning is installed or not.
	 * @param anId String dom id
	 * @param aDate Date
	 */
	fillDate : function(anId, aDate) {
	  /*
     * dateValue + sans lightning = OK
     * dateValue + lightning = KO
     * value + lightning = OK
     * value + sans lightning = erreur                
     * value + convertion + lightning = KO
     * value + convertion + sans lightning = OK                
     */
    try {
      // works when lightning is installed
      document.getElementById(anId).value = aDate != null ? aDate : new Date();
    } catch (ex) {
      // works when lightning is NOT installed
  		document.getElementById(anId).dateValue = aDate != null ? aDate : new Date();
    }		 
	},
	
  fillTaskDetail : function(aTask) {
		document.getElementById("taskmail-addTask").value = aTask.id;
		document.getElementById("taskmail-taskTitle").value = aTask.title;
		document.getElementById("taskmail-taskDesc").value = aTask.desc;
		var stateList = document.getElementById("taskmail-taskState");
		var ligne = stateList.firstChild;
		for (var i = 0; i < ligne.childNodes.length; i++) {
			if (ligne.childNodes[i].value == aTask.state) {
				stateList.selectedIndex = i;
				break;
			}
		}
		document.getElementById("taskmail-taskPriority").selectedIndex = aTask.priority;
		document.getElementById("taskmail-taskId").value = aTask.id;

		this.fillDate("taskmail-taskCreateDate", aTask.createDate);
		document.getElementById("taskmail-taskDueDateChk").checked = aTask.dueDate != null;			
		this.fillDate("taskmail-taskDueDate", aTask.dueDate);
		document.getElementById("taskmail-taskCompleteDateChk").checked = aTask.completeDate != null;
		this.fillDate("taskmail-taskCompleteDate", aTask.completeDate);
		this._disableDateField("taskmail-taskDueDate");
		this._disableDateField("taskmail-taskCompleteDate");
	},
	
	/**
	 * disable date field according to corresponding checkbox date.
	 * if complete date is checked then change state fto 'done'.
	 * @param id String date field id.
	 */
	onChkTaskDate : function(id) {
		this._disableDateField(id);
		if (id == "taskmail-taskCompleteDate" && document.getElementById(id + "Chk").checked) {
			var stateList = document.getElementById("taskmail-taskState");
			var ligne = stateList.firstChild;
			for (var i = 0; i < ligne.childNodes.length; i++) {
				if (ligne.childNodes[i].value == TASKMAIL.done_state) {
					stateList.selectedIndex = i;
					break;
				}
			}		
		}
	},

	/**
	 * disable date field according to corresponding checkbox date.
	 * checkbox id = date_field id + "Chk"
	 * @param id String date field id.
	 */
	_disableDateField : function(id) {
		var chk  = document.getElementById(id + "Chk");
		var date = document.getElementById(id);
		date.disabled = !chk.checked;
	},

	/**
	 * when state is changed to 'done', then set complete date.
	 */
	onStateChanged : function() {
		TASKMAIL.log("onStateChanged");
		var stateInput = document.getElementById("taskmail-taskState").selectedItem.value;
		if (stateInput == TASKMAIL.done_state) {
			document.getElementById("taskmail-taskCompleteDateChk").checked = true;
			this.onChkTaskDate("taskmail-taskCompleteDate");
		}
	},
	
	// folder visulisé (nsIMsgFolder, courant ou celui au moment du sticky). 
	viewedFolder : null,
	
	onFolderSelect : function() {
		// refresh task list when view is not 'all folder' and view is not sticky.		
		// View can be changed at the begin of this method.
		// si init thunderbird, même si vue all_folder, on charge la liste des tâches.
		// pas de refresh sur un voir les messages liés (dontRefreshTaskPane)
		TASKMAIL.log("onFolderSelect");
		
		var prefserv = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		var transientScope = prefserv.getBoolPref("extensions.taskmail.transientScope");
		var sticky = document.getElementById("taskmail-sticky-view").checked;

		// si la vue n'est pas figée et en 'vue multi folder', on repasse en vue 'folder'.
		// si init thunderbird, on ne change pas la vue et conserve celle persistée
		var currentView = document.getElementById("taskmail-viewFilter").selectedItem.value;
		if (     (currentView == TASKMAIL.UI.VIEW_FILTER_ALL_FOLDERS
		       || currentView == TASKMAIL.UI.VIEW_FILTER_HOTLIST)
				&& !sticky
				&& !TASKMAIL.UI.thunderbirdInit
				&& transientScope
				&& !TASKMAIL.UILink.dontRefreshTaskPane)
		{
			document.getElementById("taskmail-viewFilter").value =  TASKMAIL.UI.savedFolderView;
			currentView = TASKMAIL.UI.savedFolderView;
		} 
		
		var stickyText = document.getElementById("taskmail-sticky-text").checked;
		if (!stickyText) {
			document.getElementById("taskmail-search").reset();
		}
		
		// BUG #8, on set viewed car si démarrage TB avec sticky, on aurait pas la vue correcte.
        if (!sticky || TASKMAIL.UI.thunderbirdInit) {
			var folder = GetSelectedMsgFolders()[0];
			TASKMAIL.UI.viewedFolder = folder;
		} 

		if (    (    currentView != TASKMAIL.UI.VIEW_FILTER_ALL_FOLDERS
			     && currentView != TASKMAIL.UI.VIEW_FILTER_HOTLIST
				 && !sticky
				 && !TASKMAIL.UILink.dontRefreshTaskPane)
			||   TASKMAIL.UI.thunderbirdInit) 
		{
			TASKMAIL.UI.refreshTaskList();
		} else {
			TASKMAIL.UI.refreshTaskFolderIcon();
			TASKMAIL.UI.refreshTaskLink();
		} 

		// to refresh folder viewed icon in folder tree. 
		document.getElementById("folderTree").treeBoxObject.invalidate();
		
		TASKMAIL.UI.thunderbirdInit = false;
	},
	
	onViewFolder : function () {
		TASKMAIL.log("onViewFolder");
		var currentView = document.getElementById("taskmail-viewFilter").selectedItem.value;
		var sticky = document.getElementById("taskmail-sticky-view").checked;
		if (currentView != TASKMAIL.UI.VIEW_FILTER_ALL_FOLDERS
		    && currentView != TASKMAIL.UI.VIEW_FILTER_HOTLIST
		    && !sticky)
		{
			var folder = GetSelectedMsgFolders()[0];
			TASKMAIL.UI.viewedFolder = folder;
			TASKMAIL.UI.refreshTaskList();
		}
	},
	
	/**
	 * called on mail selection.
	 */
	onMessageSelect : function () {
		TASKMAIL.log("onMessageSelect");
		var currentView = document.getElementById("taskmail-viewFilter").selectedItem.value;
		if (currentView == TASKMAIL.UI.VIEW_FILTER_MESSAGE) {
			TASKMAIL.UI.refreshTaskList();
		}
		TASKMAIL.UI.refreshTaskLink();
		TASKMAIL.UILink.lastLinkedShowed = null;
		TASKMAIL.UILink.refreshStatusBar("task");
	},
	
	/**
	 * called on task selection.
	 * Provoque refresh de la colonne de liaison dans la liste des messages
	 * et la status bar.
	 */
	onTaskSelect : function() {
		TASKMAIL.log("onTaskSelect");
		// rafraichie la colonne de liaison dans la liste des messages.
		var tree = document.getElementById("threadTree");
		var column = tree.columns.getNamedColumn("taskmail-colTask");
		tree.treeBoxObject.invalidateColumn(column);
		TASKMAIL.UILink.lastLinkedShowed = null;
		TASKMAIL.UILink.refreshStatusBar("mail");
	},

	/**
	 * called on task selection.
	 */
	onTaskClick : function(event) {
	  TASKMAIL.log("onTaskClick");
	  // According to preference and mouse button used, show linked message.
	  if (event.target.localName == "treechildren") {
	  	// Do nothing if click on column header
		  var prefserv = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		  var pref = prefserv.getCharPref("extensions.taskmail.showMessageOnMouseClick");
			if ((event.button == 0 && pref == "LEFT") ||
			    (event.button == 1 && pref == "MIDDLE"))
			{
				TASKMAIL.UILink.showLinkedMail();
			}
	  }
	},

	// is thunderbird starting ? used to refresh task list.
	// throught onFolderSelect (and not twice using onload 1 for load and 1 for select).
	thunderbirdInit : true,
	
	/**
	 * Rafrafichie la liste des tâches
	 * Dépend du scope, des états, des filtre ET du folder à afficher (pas forcement le folder courant).
	 * Ne fait aucune modification sur l'IHM.
	 */
	refreshTaskList : function() {
		TASKMAIL.log("refreshTaskList");
		// le refresh du folder est lancé avant l'handler de la colonne des
		// emails.
		var selectedTasks = TASKMAIL.UI.getSelectedTasksKeys();
		var oldCurrentIndex = document.getElementById("taskmail-taskList").currentIndex;
		var currentTaskKey = new Array();
		currentTaskKey.push(TASKMAIL.UI.getCurrentTaskKey());
	
		TASKMAIL.UI.emptyList();
		TASKMAIL.UI.getTaskList();
		TASKMAIL.UI.selectTasksByKeys(selectedTasks);

		var statusbarLabel = TASKMAIL.UI.stringsBundle.getString("statusbar.text.empty");
		document.getElementById('taskmail-statusbar.tasks').setAttribute("label", statusbarLabel);

		// la sauvegarde de l'élément courant n'est pas parfaite sur un changement de folder.
		if (oldCurrentIndex != -1) {
			TASKMAIL.log("refreshTaskList,currentIndex="+oldCurrentIndex);
			TASKMAIL.log("refreshTaskList,currentTaskKey="+currentTaskKey);
			TASKMAIL.log("refreshTaskList,new currentIndex="+TASKMAIL.UI.getTaskIndexesFromTaskID(currentTaskKey));
			document.getElementById("taskmail-taskList").currentIndex = TASKMAIL.UI.getTaskIndexesFromTaskID(currentTaskKey);
		}
	},

	/**
	 * Met à jour les icones de liaisons dans le taskPanel en fonction des messages sélectionnés.
	 **/
	refreshTaskLink : function() {
		var selectedMailKey = null;
		try {
			selectedMailKey = gDBView.keyForFirstSelectedMessage;
		} catch (err) {
			// Components.utils.reportError("dbUpgrade " + err);
		}
		var selectedMails = gFolderDisplay.selectedMessages;
		var selectedMailKeys = selectedMails.map(function(value){return value.messageKey;});
		// parcours tout les taches et regarde s'il existe une tache liée
		var listBox = document.getElementById("taskmail-taskList");
		for (var i = 0; i < listBox.view.rowCount; i++) {
			var row = listBox.contentView.getItemAtIndex(i);
			var pk        = row.firstChild.getAttribute("pk"); 
			var taskFolderURI = row.firstChild.getAttribute("folderURI");
			var linkType = TASKMAIL.Link.getTaskLinkType(
					pk, taskFolderURI, gDBView.msgFolder.URI, selectedMailKeys);
			var linkURL = null;
			if (linkType == 3) {
				linkURL = "linked_outside";
			} else  if (linkType == 2) {
				linkURL = "linked_hilight";
			} else if (linkType == 1) {
				linkURL = "linked";
			}
			if (linkURL != null) {
			   row.childNodes[0].childNodes[1].setAttribute("properties", linkURL);
		}
		}
	},

	refreshTaskFolderIcon : function() {
		// parcours tout les taches
		var listBox = document.getElementById("taskmail-taskList");
		for (var i = 0; i < listBox.view.rowCount; i++) {
			var row           = listBox.contentView.getItemAtIndex(i);
			var pk            = row.firstChild.getAttribute("pk"); 
			var taskFolderURI = row.firstChild.getAttribute("folderURI");
			var value = taskFolderURI != GetSelectedMsgFolders()[0].URI ? "subfolder" : null;
			row.childNodes[0].childNodes[0].setAttribute("properties", value);
		}
	},

	/**
	 * recupére les tâches et les liens pour la vue en cours.
	 * @return Content (only one, flat, no arbo).
	 */
	retrieveTasks : function() {
		var result = new Array();
		//result.folderName = "root";
		
		var currentMsgFolder  = GetSelectedMsgFolders()[0];;
		var currentTaskFolder = TASKMAIL.UI.viewedFolder;
		var viewFilter = document.getElementById("taskmail-viewFilter").selectedItem.value;
		var stateFilter = this.getDBStateFilterString();
		var text = document.getElementById("taskmail-search").value;

		TASKMAIL.log("retrieveTasks : viewFilter=" + viewFilter + ",currentMsgFolder="+currentMsgFolder+",currentTaskFolder="+currentTaskFolder);
		if (viewFilter == this.VIEW_FILTER_MESSAGE) {
			// recherche par mail
			try {
				var mails = gFolderDisplay.selectedMessages;
				var messageId = mails[0].messageId;
				 TASKMAIL.log(selectedMailKey);
				// il faut charger les liens avant les taches
				TASKMAIL.DB.getLinkSQLite(currentMsgFolder, currentTaskFolder, viewFilter);
				result = TASKMAIL.DB.getTaskListSQLite(currentMsgFolder, messageId,
						currentTaskFolder, stateFilter, viewFilter, text);
			} catch (err) {
				// Components.utils.reportError("dbUpgrade " + err);
			}
		} else if (viewFilter == this.VIEW_FILTER_ALL_FOLDERS || viewFilter == this.VIEW_FILTER_HOTLIST) {
			// all folders or hot list
			TASKMAIL.DB.getLinkSQLite(currentMsgFolder, currentTaskFolder, viewFilter);
			result = TASKMAIL.DB.getTaskListSQLite(null, null,
						null, stateFilter, viewFilter, text);
		} else if (viewFilter == this.VIEW_FILTER_FOLDER) {
			// folder
			TASKMAIL.DB.getLinkSQLite(currentMsgFolder, currentTaskFolder, viewFilter);
			result = TASKMAIL.DB.getTaskListSQLite(null, null,
					currentTaskFolder, stateFilter, viewFilter, text);
		} else {
			// subfolders (viewFilter == this.VIEW_FILTER_SUBFOLDERS)
			// il faut charger les liens avant les taches
			TASKMAIL.DB.getLinkSQLite(currentMsgFolder, currentTaskFolder, viewFilter);
			result = TASKMAIL.DB.getTaskListSQLite(null, null,
					currentTaskFolder, stateFilter, viewFilter, text);
		}
		return result;
	},

	/**
	 * tri un content
	 * @param Array[Task]
	 * @return Array[Task] ordered
	 */
	sortTaskList : function (temp) {
		switch (this.currentOrder.columnId) {
			case "taskmail-taskPriorityCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"priority",TASKMAIL.UI.currentOrder.order);});
				break;
			case "taskmail-taskStateCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"state",TASKMAIL.UI.currentOrder.order);});
				break;
			case "taskmail-taskCreateDateCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"createDate",TASKMAIL.UI.currentOrder.order);});
				break;
			case "taskmail-taskDueDateCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"dueDate",TASKMAIL.UI.currentOrder.order);});
				break;
			case "taskmail-taskCompleteDateCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"completeDate",TASKMAIL.UI.currentOrder.order);});
				break;
			case "taskmail-taskTitleCol":
				temp = temp.sort(function (a,b) { return TASKMAIL.sortTask(a,b,"title",TASKMAIL.UI.currentOrder.order);});
				break;
		}
		
		return temp;
	},
	
	/**
	 * Récupère les tâches et remplit le taskPanel, rafraichit la UI
	 **/
	getTaskList : function() {
		// On va remonter les liens, on reset donc les tableaux
		TASKMAIL.Link.resetLink();
		
		var temp = this.retrieveTasks();
		temp = this.sortTaskList(temp);
		for(var i=0; i<temp.length; i++) {
				this.fillTaskList(temp[i]);
		}
		
		// refresh link
		this.refreshTaskLink();
		this.onTaskSelect();
	},

	taskDetailPK : -1,
	addWithLink : false,
	stringsBundle : null,
	
	VIEW_FILTER_FOLDER      : 0,
	VIEW_FILTER_SUBFOLDERS  : 1,
	VIEW_FILTER_MESSAGE     : 2,
	VIEW_FILTER_ALL_FOLDERS : 3,
	VIEW_FILTER_HOTLIST     : 4,

	/**
	 * recupére les index des taches dont les pk sont fournies
	 * @param taskID : tableau de taskID
	 * @return tableau d'index dans l'ordre de visualisation.
	 */
	getTaskIndexesFromTaskID : function(taskID) {
		var result = new Array();
		var nbResult = 0;
		var listBox = document.getElementById("taskmail-taskList");
		var i = 0;
		while (i < listBox.view.rowCount) {
			var row = listBox.contentView.getItemAtIndex(i);
			var pk = parseInt(row.firstChild.getAttribute("pk"));
			if (taskID.indexOf(pk) > -1) {
				result[nbResult] = i;
				nbResult += 1;
			}
			i++;
		}
		TASKMAIL.log("getTaskIndexesFromTaskID result="+result);
		return result;
	},

	/**
	 * recupére l'index de la taches dont la pk est fournie
	 * @param taskID taskID
	 * @return index -1 if not found
	 */
	getTaskIndexFromTaskID : function(taskID) {
		var result = -1;
		var listBox = document.getElementById("taskmail-taskList");
		var i = 0;
		while (i < listBox.view.rowCount) {
			var row = listBox.contentView.getItemAtIndex(i);
			var pk = parseInt(row.firstChild.getAttribute("pk"));
			if (pk == taskID) {
				result = i;
				break;
			}
			i++;
		}
		return result;
	},

	/**
	 * sépare la liste des taskID fournis en tâches visibile et invisibles.
	 * @param taskID : tableau de taskID
	 * @return { visible : tableau de taskID visible, 
	 *           unvisible : tableau de tâche invisible
	 *         }
	 */
	splitVisibleTasks : function(taskIDs) {
		var result = { visible : new Array(), unvisible : new Array() };
		var listBox = document.getElementById("taskmail-taskList");
		var i = 0;
		var allVisibleTasks = new Array();
		while (i < listBox.view.rowCount) {
			var row = listBox.contentView.getItemAtIndex(i);
			var pk = parseInt(row.firstChild.getAttribute("pk"));
			allVisibleTasks.push(pk);
			i++;
		}
		for(var i=0; i<taskIDs.length; i++) {
			if (allVisibleTasks.indexOf(taskIDs[i]) > -1) {
				result.visible.push(taskIDs[i]);
			} else {
				result.unvisible.push(taskIDs[i]);
			}
		}
		return result;
	},

	/**
	 * sépare la liste des mails fournis en mails visibile et invisibles.
	 * @param mails : tableau de mails
	 * @param folderURI : String : folderURI pour faire la séparation.
	 * @return { visible : tableau de mails visible, 
	 *           unvisible : tableau de mails invisible
	 *         }
	 */
	splitVisibleMails : function(mails, folderURI) {
		var result = { visible : new Array(), unvisible : new Array() };
		for(var i=0; i<mails.length; i++) {
			if (mails[i].folderURI == folderURI) {
				result.visible.push(mails[i]);
			} else {
				result.unvisible.push(mails[i]);
			}
		}
		return result;
	},

	/**
	 * return array of selected task id.
	 * @return [Task] an empty array is no task is selected.
	 */
	getSelectedTasks : function() {
		var listBox = document.getElementById("taskmail-taskList");
		var result = [];
		var rangeCount = listBox.view.selection.getRangeCount();
		try {
			for (var i = 0; i < rangeCount; i++) {
			   var start = {};
			   var end = {};
			   listBox.view.selection.getRangeAt(i, start, end);
			   for(var c = start.value; c <= end.value; c++)
			   {
			   		var taskId = parseInt(listBox.view.getItemAtIndex(c).firstChild.getAttribute("pk"));
						var folderURI = listBox.view.getItemAtIndex(c).firstChild.getAttribute("folderURI");
			   		var newTask = new TASKMAIL.Task(taskId, folderURI, null, null, null, null, null, null, null);
			      result.push(newTask);
			   }
			}		
		} catch (err) {}
		return result;
	},
	
	/**
	 * return tasks selected keys.
	 * 
	 * @return Array[int] an empty array if no task is selected.
	 */
	getSelectedTasksKeys : function() {
		var tasks = this.getSelectedTasks();
		return this.getTasksKeys(tasks);
	},

	/**
	 * Transforms tasks array into task key arrays.
	 * @param [Task]
	 * @return [int]
	 */
	getTasksKeys : function(tasks) {
		var result = new Array();
		for(var i=0; i<tasks.length; i++) {
			result.push(tasks[i].id);
		}
		return result;
	},

	/**
	 * return current selected task id.
	 * @return int -1 if no current task 
	 */
	getCurrentTaskKey : function() {
		var result = -1;
		var listBox = document.getElementById("taskmail-taskList");
		var currentIndex = listBox.currentIndex;
		try {
      if (currentIndex != -1 && listBox.view.getItemAtIndex(currentIndex) != null) {
  			// getItemAtIndex can return null even currentIndex != -1 !
  			result  = parseInt(listBox.view.getItemAtIndex(currentIndex).firstChild.getAttribute("pk"));
  		}
    } catch (ex) {
        TASKMAIL.log("getCurrentTaskKey:currentIndex="+currentIndex);
    }
		return result;
	},
	
	getSelectedMailKey : function() {
		var selectedMessages = gFolderDisplay.selectedMessages;
		var result = new Array();
		for (var i = 0; i < selectedMessages.length; i++) {
			result[result.length] = selectedMessages[i].messageKey;
		}
		return result;
	},

	getMailIndexFromMailKey : function(mailKeys) {
		var result = new Array();
		var nbResult = 0;
		for (var j = 0; j < mailKeys.length; j++) {
			var i = 0;
			while (i < gDBView.rowCount) {
				if (gDBView.getKeyAt(i) == mailKeys[j]) {
					result[nbResult] = i;
					nbResult += 1;
				}
				i++;
			}
		}
		   TASKMAIL.log(result);
		return result;
	},

	/**
	 * select tasks by keys. clear the selection when beginning.
	 * 
	 * @param Array[int]
	 *            keys
	 * @return void
	 */
	selectTasksByKeys : function(keys) {
		var listBox = document.getElementById("taskmail-taskList");
		var first = false;
		for (var i = 0; i < listBox.view.rowCount; i++) {
			var row = listBox.contentView.getItemAtIndex(i);
			// parseInt car l'attribut du dom est forcement une string
			var temp = parseInt(row.firstChild.getAttribute("pk"));
			if (keys.indexOf(temp) > -1) {
				listBox.view.selection.rangedSelect(i, i, first);
				first = true;
			}
			
		}
	},

	emptyList : function() {
		var listBox = document.getElementById("taskmail-taskTreeChild");
		while (listBox.firstChild) {
  		listBox.removeChild(listBox.firstChild);
		}
	},

	// view can be : 
	// * 'all folder' = do not depend on current folder = all_folders or hot_list,
	// * 'folder'     = depend on current folder = folder, subfolder or message.
	
	// the previous view just before changing view, to detect changing between 'all folder' and 'folder'
	viewBeforeEvent : 1,
	
	// the previous view before changing to 'all folder' view to restore.
	savedFolderView : 1,

	/*
	 * Appelé sur un changement de scope.
	 */
	onViewChange : function() {
  		TASKMAIL.log("onViewChange");
		var viewFilter = document.getElementById("taskmail-viewFilter").selectedItem.value;
		
		var isPreviousFilterAllFolders = this.viewBeforeEvent == this.VIEW_FILTER_ALL_FOLDERS ||
		                                 this.viewBeforeEvent == this.VIEW_FILTER_HOTLIST;
		var isCurrentFilterAllFolders  = viewFilter == this.VIEW_FILTER_ALL_FOLDERS ||
		                                 viewFilter == this.VIEW_FILTER_HOTLIST;
		this.refreshTaskList();
		
		// si on passe en vue 'all folder', on sauvegarde la vue précédente pour pouvoir la restaurer.
		// ne sauvegarde pas la vue précédente en passant de 'all folders' à 'hot list'.
		if (isCurrentFilterAllFolders && !isPreviousFilterAllFolders) {
			this.savedFolderView = this.viewBeforeEvent;
		}
		this.viewBeforeEvent = viewFilter;
	},
	
	/**
	 * On refraichie la liste de tache sur unsitck. 
	 */
	onViewStick : function () {
		var sticky = document.getElementById("taskmail-sticky-view").checked;
		if (!sticky) {
			var folder = GetSelectedMsgFolders()[0];
			TASKMAIL.UI.viewedFolder = folder;
			TASKMAIL.UI.refreshTaskList();
		}
		// to refresh folder viewed icon in folder tree. 
		document.getElementById("folderTree").treeBoxObject.invalidate();
	},
	
	loadManual : function (aEvent) {
		var stringbundle = document.getElementById("taskmail-string-bundle");
		var href = stringbundle.getString("docUrl");		
	 	messenger.openURL(href);
	},
  
  /**
	 * return all the root folders, Array.length == 0 if no folder
	 * @return Array(nsIMsgFolder)
	 */
	_getAllRootFolders : function () {
  	var servers = Components.classes["@mozilla.org/messenger/account-manager;1"].
            getService(Components.interfaces.nsIMsgAccountManager)
            .allServers;
    var list = servers.Count() + ":"
    var result = new Array();
    for (var i = 0; i < servers.Count(); ++i) {
    	var server = servers.QueryElementAt(i, Components.interfaces.nsIMsgIncomingServer)
      if (!server.deferredToAccount && result.indexOf(server.rootMsgFolder) == -1) {
      	// It's possible that rootFolder is not duplicated        
        result.push(server.rootMsgFolder);
      }
    }
    return result;
  },

	init : function() {
  		TASKMAIL.log("début init");
		document.getElementById("folderTree").addEventListener("select",
				TASKMAIL.UI.onFolderSelect, false);
		document.getElementById("threadTree").addEventListener("select",
				TASKMAIL.UI.onMessageSelect, false);
		document.getElementById("taskmail-taskList").addEventListener("select",
				function(e) {
					TASKMAIL.UI.onTaskSelect();
				}, false);
		document.getElementById("taskmail-taskList").addEventListener("click",
				TASKMAIL.UI.onTaskClick, false);
		// bug, pas possible d'utiliser onpopupshowing dans le .xul
		document.getElementById("mailContext").addEventListener("popupshowing",
				function(e) {
					TASKMAIL.UI.adjustContextMenu();
				}, false);
				
		document.getElementById("taskmail-row-menu").addEventListener("popupshowing",
				TASKMAIL.UI.adjustTaskMenu, false);

		var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
				.getService(Components.interfaces.nsIMsgFolderNotificationService);

		notificationService.addListener(TASKMAIL.MailListener,
				notificationService.folderRenamed
						| notificationService.folderDeleted
						| notificationService.folderMoveCopyCompleted
						| notificationService.msgsMoveCopyCompleted
						| notificationService.msgsDeleted);

		// now register a compact listener on every mail folder
  	var nsIFolderListener = Components.interfaces.nsIFolderListener;
		Components.classes["@mozilla.org/messenger/services/session;1"]
              .getService(Components.interfaces.nsIMsgMailSession)
              .AddFolderListener(TASKMAIL.FolderCompactListener,
                                 nsIFolderListener.event);

		this.stringsBundle = document.getElementById("taskmail-string-bundle");
		
		document.getElementById("folderTree").addEventListener("dragover", TASKMAIL.UIDrag.onOverFolder, false);
		document.getElementById("folderTree").addEventListener("drop", TASKMAIL.UIDrag.onDropFolder, false);
		
		document.getElementById("threadTree").addEventListener("dragover", TASKMAIL.UIDrag.onOverMail, false);
		document.getElementById("threadTree").addEventListener("drop", TASKMAIL.UIDrag.onDropMail, false);
		
		// for date formating
		this.dateService = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
	                              .getService(Components.interfaces.nsIScriptableDateFormat);

		// Migrate preferences from taskmail. to extensions.taskmail.
		this.migratePrefs();
	
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		// pose un observe sur les états définis dans les préférences
		prefs.addObserver("", this, false);

		// charge les états pour la liste de tâches et le détail d'une tâche.
		this.getStatesFromPref();
    
		this.initialiseOrder();
    
		// replace default getCellProperties.
		this.oldGetCellProperties = gFolderTreeView.getCellProperties;
		gFolderTreeView.getCellProperties = TASKMAIL.UI.new_getCellProperties;
	},
	
	/**
	 * migrate preferences from taskmail. to extensions.taskmail.
	 * needed until 2.2.1 desappears.
	 */
	migratePrefs : function  () {
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		var oldBranch = prefs.getBranch("taskmail.");
		var obj = {};
		var keys = oldBranch.getChildList("",obj);
		if (keys.length > 0) {
			var newBranch = prefs.getBranch("extensions.taskmail.");
			for(var i=0; i<keys.length; i++) {
				var value = oldBranch.getCharPref(keys[i]);
				newBranch.setCharPref(keys[i], value);
			}
			oldBranch.deleteBranch("");
		}
	},
	
	observe : function (subject, topic, data) {
		  TASKMAIL.log("preferences observer");
		if (topic != "nsPref:changed") {
			return;
		}
	 
		switch(data) {
			case "extensions.taskmail.states":
  				TASKMAIL.log("states changed");
				this.getStatesFromPref();
				this.refreshTaskList();
				break;
		}	
	},
	
	/*
	 * States array [{id, label}].
	 */
	states : new Array(),
	
	dateService : null,
	
	/**
	 * Récupére les états depuis les préférences et remplie la liste déroule du détail de tâche.
	 * et le menu deroulant du filtre d'état
	 * Appelé après changement des préférences par observer ou au lancement de l'appli.
	 */
	getStatesFromPref : function () {
		  TASKMAIL.log("getStatesFromPref");
		var result = new Array();
	    var prefserv = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
	    var statesPref = prefserv.getComplexValue("extensions.taskmail.states",Components.interfaces.nsIPrefLocalizedString).data;
    var statePrefArray = statesPref.split(",");
    for(var index=0; index<statePrefArray.length; index++) {
    	var id         = parseInt(statePrefArray[index].substring(0,statePrefArray[index].indexOf("|")));
    	var stateLabel = statePrefArray[index].substring(statePrefArray[index].indexOf("|")+1);
    	var state = { id : id, label : stateLabel };
    	result.push(state);
    }
    // stocke les états (id et libelle)
    this.states = result;
    
		//charge le menu déroulant avec les libelles et les id sous forme de checkbox
    var stateList = document.getElementById("taskmail-taskState");
    var index = stateList.selectedIndex;
    
		stateList.selectedIndex = index;
		stateList.removeAllItems();    
		for(var i=0; i<this.states.length; i++) {
    	// remplit la liste déroulante dans le détail de tache.
    	stateList.appendItem(this.states[i].label,this.states[i].id);
    }

    // charge le menu déroulant du filtre des états
    var stateButton = document.getElementById("taskmail-stateFilter");
    var stateFilter = document.getElementById("taskmail-stateFilterPopup");
    // récupéré pour savoir ce qui était coché.
    var selectedIdExp = stateButton.getAttribute("taskSelectedIdExp");
    var selectedStateIdArray = selectedIdExp.split(",").map(function (e) {return parseInt(e);});
    
    for(var i=stateFilter.childNodes.length - 1; i>=0; i--) {
    	stateFilter.removeChild(stateFilter.childNodes[i]);
    }    
    for(var i=0; i<this.states.length; i++) {
    	// remplit le filtre d'état
    	var menuitem = document.createElement('menuitem');
    	menuitem.setAttribute("label", this.states[i].label);
    	menuitem.setAttribute("id", this.states[i].id);
    	menuitem.setAttribute("type", "checkbox");
    	if (selectedStateIdArray.indexOf(this.states[i].id) > -1) {
    		menuitem.setAttribute("checked", true);
  		}
    	stateFilter.appendChild(menuitem);
    }
		this.refreshStateFilterLabel();
  },
  
  /**
   * recoche la derniere case et recalcul les id des états cochés pour la persistance.
   * Appele après un cochage d'état.
   */
  changeStateFilter : function (event) {
  	  TASKMAIL.log("changeStateFilter");
  	var noStatesCheck = true;
  	var stateFilterMenu = document.getElementById("taskmail-stateFilterPopup");
  	for(var i=0; i<stateFilterMenu.childNodes.length; i++) {
  		var stateChecked = stateFilterMenu.childNodes[i].getAttribute("checked"); 
  		if (stateChecked) {
 				noStatesCheck = false;
 				break;
  		}
  	}
  	if (noStatesCheck) {
  		// si on essaie de décocher la dernière, on la recoche car on ne peut pas avoir aucune coche
  		event.target.setAttribute("checked", true);
  	} else {
  		this.refreshStateFilterLabel();
  		this.refreshTaskList();
  	}
  },
  
  /**
   * recalcul le libellé du bouton des états et les id sélectionné
   * pour la persistance du filtre.
   */
  refreshStateFilterLabel : function () {
  	  TASKMAIL.log("refreshStateFilterLabel");
    var stateButton = document.getElementById("taskmail-stateFilter");
    var stateFilter = document.getElementById("taskmail-stateFilterPopup");
    var filterLabel = "";
    var allStatesChecked = true;
    var selectedStateId = new Array();
        
    // remplit le filtre d'état
    for(var i=0; i<stateFilter.childNodes.length; i++) {
    	var checked = stateFilter.childNodes[i].getAttribute("checked"); 	
    	if (checked) {
    		if (filterLabel == "") {
    			filterLabel += stateFilter.childNodes[i].getAttribute("label");
    		} else if (filterLabel.charAt(filterLabel.length - 1) != ".") {
    			filterLabel += ",...";
    		}
    		selectedStateId.push(stateFilter.childNodes[i].getAttribute("id"));
    	} else {
  			allStatesChecked = false;
  		}
    }
    // Si toutes les coches sont cochés on met un libellé
    if (allStatesChecked) {
  		filterLabel = TASKMAIL.UI.stringsBundle.getString('taskmail.allStates');
  	}
  	stateButton.label = filterLabel;
  	stateButton.setAttribute("taskSelectedIdExp",selectedStateId.join(","));
  },
  
  /**
   * retourne la liste des états sélectionnés
   * Utilisé pour le requetage. 
   */
   getDBStateFilterString : function () {
  	var result = "";
  	var allStatesChecked = true;
  	var stateFilter = document.getElementById("taskmail-stateFilterPopup");
  	for(var i=0; i<stateFilter.childNodes.length; i++) {
  		var stateChecked = stateFilter.childNodes[i].getAttribute("checked"); 
  		if (stateChecked) {
  			result += stateFilter.childNodes[i].getAttribute("id");
  		} else {
  			allStatesChecked = false;
  		}
  	}
  	if (allStatesChecked) {
  		result = "";
  	}
  	return result;
  },
  
  /**
   * récupére le libelle d'une tache à partir d'un id d'éta.
   * Utilisé pour remplir la liste de tache et le rapport.
   */
  getStateLabel : function (id) {
  	var result = "";
  	for(var index=0; index<this.states.length; index++) {
  		if (this.states[index].id == id) {
  			return this.states[index].label; 
  		}
  	}  	
	return "";
  },
  
  toggleTaskPane : function () {
  	var pane = document.getElementById("taskmail-splitter");
  	TASKMAIL.log("toggleTaskPane, pane.collapsed=" + pane.getAttribute("state"));
		if (pane.getAttribute("state") == "open" || pane.getAttribute("state") == null) {
  		pane.setAttribute("state","collapsed");
  	} else {
  		pane.setAttribute("state","open");
  	} 
  },
  
  /**
   * put the right css class to put the right arrow on priority column 
   */
  updatePriorityColumnHeader : function () {
  	var col = document.getElementById("taskmail-taskList").columns.getNamedColumn("taskmail-taskPriorityCol");
  	switch (col.element.getAttribute("sortDirection")) {
  		case "ascending" :
  			col.element.setAttribute("class","treecol-image priorityAscendingColumnHeader");
  			break;
  		case "descending" :
  			col.element.setAttribute("class","treecol-image priorityDescendingColumnHeader");
  			break;
  		case "natural" :
  			col.element.setAttribute("class","treecol-image priorityColumnHeader");
  			break;
  	}
  },
  
  /**
   * current order
   */
  currentOrder : {
  	columnId : "", 
    order : "" /* "ascending" or "descending" or "" */
  },
  
  /**
   * set the initial state of the previous currentOrder object. Called on extension's initialisation.
   * use the columns's persistant attributes "sortDirection".   
   */
  initialiseOrder : function () {
  	// reset order
  	this.currentOrder = {columnId : "", order : ""};
  	// find the current ordered column if any
  	var taskList = document.getElementById("taskmail-taskList");
  	for(var i=0; i<taskList.columns.length; i++) {
	  	var column = taskList.columns.getColumnAt(i);
	  	var order = column.element.getAttribute("sortDirection");
	  	if (order == "ascending" || order == "descending") {
	  		this.currentOrder.columnId = column.id;
	  		this.currentOrder.order = order;
	  	}
  	}
  },
  
  /**
   * get next order from column and current sort. 
   * event.target.getAttribute("id")
   */
  getNextColumnOrder : function (column, order) {
	  var result = "";
	  switch (column) {
		  case "taskmail-taskTitleCol" :
			  if (order == "natural") {
				  result = "ascending";
			  } else if (order == "ascending") {
				  result = "descending";
			  } else {
				  result = "natural";
			  }
			  break;
		  default :
			  if (order == "natural") {
				  result = "descending";
			  } else if (order == "descending") {
				  result = "ascending";
			  } else {
				  result = "natural";
			  }
		  	  break;
	  }
	  return result;
  },
  
  /**
   * manage header during order changes
   * only one column ordered. order walks trought "natural", "descending", "ascending".
   */
  onChangeOrder : function (event) {
    	TASKMAIL.log("onChangeOrder");
  	// if asking to make an new column ordered and there is a previous order*
  	// then reset previous order
  	if(this.currentOrder.columnId != "" && event.target.getAttribute("id") != this.currentOrder.columnId) {
	  	var taskList = document.getElementById("taskmail-taskList");
  		var previousOrderedColumn = taskList.columns.getNamedColumn(this.currentOrder.columnId); 
  		previousOrderedColumn.element.setAttribute("sortDirection", "natural");
	}
 	// determine if the new order is ascending, descending or neutral
 	// and change DOM attribute and this.currentOrder
 	var currentOrder = event.target.getAttribute("sortDirection");
  	var order = this.getNextColumnOrder(event.target.getAttribute("id"), currentOrder);
	event.target.setAttribute("sortDirection",order);
	this.currentOrder.order = order;
	this.currentOrder.columnId = order == "natural" ? "" : event.target.getAttribute("id");

	// update class on priority column to display the right iconic arrow.
 	this.updatePriorityColumnHeader();
  	this.refreshTaskList();
  },
  
  updatePriority : function (event, priority) {
  	var tasks = this.getSelectedTasks();
  	TASKMAIL.DB.updateTaskProritySQLite(tasks, priority);
		this.refreshTaskList();
  },
  
  incrementPriority : function (event, priority) {
  	var tasks = this.getSelectedTasks();
  	TASKMAIL.DB.incrementTaskProritySQLite(tasks);
		this.refreshTaskList();
  },
  
  decrementPriority : function (event, priority) {
  	var tasks = this.getSelectedTasks();
  	TASKMAIL.DB.decrementTaskProritySQLite(tasks);
		this.refreshTaskList();
  },
  
  /**
   * Change task state to done and completeDate.
   */
  updateTaskStateDone : function (event) {
  	var taskKeys = this.getSelectedTasksKeys();
  	TASKMAIL.DB.updateStateTaskSQLite(taskKeys, 4);
		this.refreshTaskList();
  },
  
 	/**
 	 * format a date with OS settings.
 	 * @param a Date
 	 * @return a string (dd/mm/yyyy). si aDate is null, then null
 	 */
  formatDate : function (aDate) {
  	var result = null;
  	if (aDate != null)  {
			result = this.dateService.FormatDate("", this.dateService.dateFormatShort,
	                              aDate.getFullYear(),
	                              aDate.getMonth()+1,
	                              aDate.getDate());
  	}
		return result;
  },
  
  /**
   * Old callback.
   */
	oldGetCellProperties : null,
	
	/**
   * Change icon folder when task view is sticky or task view shows 
   * an other folder that current one.
   */
  new_getCellProperties : function (row,col,props) {
	//TASKMAIL.log("new_getCellProperties, row=" + row);
	//gFolderTreeView._rowMap[row].getProperties(props,col);
	// Call old version. Make color folder extension works with Tasks & mails.
	//TASKMAIL.log("new_getCellProperties, appel ancetre");
	gFolderTreeView.getCellProperties = TASKMAIL.UI.oldGetCellProperties;
	var result = gFolderTreeView.getCellProperties(row,col,props);
	gFolderTreeView.getCellProperties = TASKMAIL.UI.new_getCellProperties;
	if (col.id == "folderNameCol") {
		var sticky = document.getElementById("taskmail-sticky-view").checked;
	    	var viewedFolder = TASKMAIL.UI.viewedFolder != null ? TASKMAIL.UI.viewedFolder.URI : null;
		var currentFolder = gDBView != null ? gDBView.msgFolder.URI : null;
	     if (gFolderTreeView._rowMap[row]._folder.URI == viewedFolder
		    && (sticky || TASKMAIL.UI.viewedFolder.URI != currentFolder)) {
			//var acAtomServ = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
		     //props.AppendElement(acAtomServ.getAtom("taskmail-viewedFolder"));
			result += " taskmail-viewedFolder";
		}      
	}
	return result;	
  }
}

if (!TASKMAIL.UILink)
	TASKMAIL.UILink = {};
TASKMAIL.UILink = {
	/**
	 * lie email et tâches courants. En fonction du send du lien, un seul objet
	 * sélectionnable
	 * @param draganddropTarget        string, where the drag is drop, "task" or "mail" else undefined
	 * @param draganddropTargetElement [task] or [message], drop's targetdropTarget else undefined 
	 */
	linkTask : function(draganddropTarget, draganddropTargetElement) {
		var folder = TASKMAIL.UI.viewedFolder;
		var tasks = TASKMAIL.UI.getSelectedTasks();
		var mails = gFolderDisplay.selectedMessages;
		if (draganddropTarget == "task") {
			tasks = draganddropTargetElement;
		} else if (draganddropTarget == "mail") {
			mails = draganddropTargetElement;
		}
		var taskIds = TASKMAIL.UI.getTasksKeys(tasks);
		if (mails.length > 1 && taskIds.length > 1) {
			// on autorise les liaisons si un des deux côtés a 1 seul
			// éléments sélectionné.
			alert(TASKMAIL.UI.stringsBundle
					.getString("LinkAlertTooManyObjects"));
			return;
		}
	    try {
		if (mails.length == 1) {
			for (var i = 0; i < taskIds.length; i++) {
				var taskId = taskIds[i];
				TASKMAIL.DB.linkTaskSQLite(taskId, mails[0]);
			}
		} else {
			for (var i = 0; i < mails.length; i++) {
				TASKMAIL.DB.linkTaskSQLite(taskIds[0], mails[i]);
			}
		}
	    } catch(e) {
			TASKMAIL.log(e);
	    }
		TASKMAIL.UI.refreshTaskList();
		TASKMAIL.UI.onTaskSelect();
	},

	/**
	 * détruit tous les liens entre les emails sélectionnés et les taches
	 * sélectionnées.
	 * 
	 * @return void
	 */
	unlinkTask : function() {
		if (window.confirm(TASKMAIL.UI.stringsBundle
				.getString('confirmDeleteLink'))) {
			// parcours tous les messages sélectionnés pour trouver les
			// taches liées dans celles sélectionnés
			// TODO optimisation possible en n'invocant uniquement pour les
			// liens liées;
			var selectedMessages = gFolderDisplay.selectedMessages; // OK un
			// objet msg
			var selectedTasks = TASKMAIL.UI.getSelectedTasksKeys();
			for (var i = 0; i < selectedMessages.length; i++) {
				for (var j = 0; j < selectedTasks.length; j++) {
					TASKMAIL.DB.unlinkTaskSQLite(selectedMessages[i],
							selectedTasks[j]);
				}
			}
			TASKMAIL.UI.refreshTaskList();
			TASKMAIL.UI.onTaskSelect();
		}
	},

	/**
	 * sélectionne le prochain élèment lié en fonction de la zone qui a le focus
	 * appelé par shift-L.
	 */
	showLinked : function (event) {
		TASKMAIL.log("showLinked");
		var focused = document.commandDispatcher.focusedElement;
		if (document.getElementById("taskmail-taskList") == focused) {
			TASKMAIL.UILink.showLinkedMail();
		} else if (document.getElementById("threadTree") == focused) {
			TASKMAIL.UILink.showLinkedTask();
		}
	},	
	
	/**
	 * taskId of the last showed linked task.
	 * updated by showLinkedTask.
	 * nécessiter de stocker p et non pas l'indice car lors d'un changement 
	 * de folder, l'ordre des tâches liées peut varier.
	 * Pas réellement nécessaire de reseter puisque l'algo est stable en cas 
	 * de changement de folder.
	 */
	lastLinkedShowed : null,
	
	/**
	 * Permet d'éviter le double rafraichissement de la status bar 
	 * sur une showLinkedTask : 1 fois sur la sélection de la tache et 1
	 * depuis  showLinkedTask.
	 */
	noStatusBarRefresh : false,

	/**
	 * Sélectionne les tâches liées aux emails sélectionnés.
	 */
	showLinkedTask : function() {
		// algo : 
		// 1) récupére la liste des tâches liées à l'email courant.
		// 2) on split en visible et unvisible et on concatene ces 2 listes
		// 3) on prend la tâche suivante dans les visibles ou invisibles.
		// 4) si on est dans une invisible on la rend visible
		// 5) si on est à la derniere, on repart au début.
		try {
			// récupére la key du 1° email selectionné
			var mailKey = gDBView.keyForFirstSelectedMessage;
			// recupére les ID de taches liées au mail
			var taskIDs = TASKMAIL.Link.getTaskIDFromMailID(gDBView.msgFolder.URI, mailKey);
			if (taskIDs.length > 0) {
				// on a des tâches liées
				var visibleTasks = TASKMAIL.UI.splitVisibleTasks(taskIDs);
				var tasksLoop = visibleTasks.visible.concat(visibleTasks.unvisible); 
				var nextTaskId = -1;
				if (TASKMAIL.UILink.lastLinkedShowed == null) {
					nextTaskId = tasksLoop[0];
				} else if (tasksLoop.indexOf(TASKMAIL.UILink.lastLinkedShowed) + 1 < tasksLoop.length) {
					// si jamais on a changé de folder, la recherche de la précédente tache
					// va probalement échoué donc indexOf = -1 et donc on prendra la 1° des tâches liées 
					nextTaskId = tasksLoop[tasksLoop.indexOf(TASKMAIL.UILink.lastLinkedShowed) + 1];
				} else {
					nextTaskId = tasksLoop[0];
				}
				if (visibleTasks.unvisible.indexOf(nextTaskId) != -1) {
					// on essaie de la rendre visible.
					// Change la vue sur le folder de la tâche si nécessaire
					var task = TASKMAIL.DB.getTaskDetailSQLite(nextTaskId);
					var taskFolderURI = task.folderURI;
					var currentFolderURI = TASKMAIL.UI.viewedFolder.URI;
					var sticky = document.getElementById("taskmail-sticky-view").checked;
					if (taskFolderURI != currentFolderURI && !sticky) {
						var folderDB = MailUtils.getFolderForURI(taskFolderURI, false);
						TASKMAIL.UI.viewedFolder = folderDB;
						TASKMAIL.UI.refreshTaskList();
						// to refresh folder viewed icon in folder tree. 
						document.getElementById("folderTree").treeBoxObject.invalidate();
					}
					// si on est en vue folder, on voit les tâches de toutes les folders.
					// change le filtrage pour rajouter l'état de la tâche s'il n'est pas coché
					var stateFilter = document.getElementById("taskmail-stateFilterPopup");
					for(var i=0; i<stateFilter.childNodes.length; i++) {
				  	var state = stateFilter.childNodes[i].getAttribute("id");
				  	var checked = stateFilter.childNodes[i].getAttribute("checked");
				  	if (state == task.state && checked == "") {
					  	stateFilter.childNodes[i].setAttribute("checked", true);
							TASKMAIL.UI.changeStateFilter();
							break;
				  	} 
				  }
				  // annule le filtre text
					var stickyText = document.getElementById("taskmail-search").value;
					if (stickyText != "") {
						document.getElementById("taskmail-search").reset();
						TASKMAIL.UI.refreshTaskList();
					}
				}
				var taskIndex = TASKMAIL.UI.getTaskIndexFromTaskID(nextTaskId);
				// sélectionne la tâche avec l'id suivant
				this.noStatusBarRefresh = true;
				document.getElementById("taskmail-taskList").view.selection.select(taskIndex);
				document.getElementById("taskmail-taskList").treeBoxObject.ensureRowIsVisible(taskIndex);
				this.noStatusBarRefresh = false;
				TASKMAIL.UILink.lastLinkedShowed = nextTaskId;
			}
			TASKMAIL.UILink.refreshStatusBar("task");
		} catch (err) {
			Components.utils.reportError("showLinkedTask " + err);
		}
	},

	/**
	 * Utilisé pour bloquer le rafraichissement du taskPane
	 * sur un changement de folder qui serait provoqué
	 * par un showMessage et qui pourrait donc faire perdre
	 * la tâche en cours.
	 */
	dontRefreshTaskPane : false,
	
	/**
	 * selection le prochain email liée. basé sur la tache qui a reçue le click
	 * droit ou item passé suite à un ctrl-double clic.
	 * La commande n'est utilisable que si une seule tâche est sélectionnée.
	 * La commande est utilisable même si la tâche n'est pas dans le folder courant.
	 */
	showLinkedMail : function() {
		// TODO le folder associé à une âche n'est pas forcement un et un seul folder.
		var selectedTask = TASKMAIL.UI.getSelectedTasks();
		if (selectedTask.length == 1) {
			var taskID = selectedTask[0].id;
			// recupére les keys de mail liés à la tache
			var keysMails = TASKMAIL.Link.getMailsFromTaskID(taskID);
			if (keysMails != null && keysMails.length > 0) {
				var splitVisibleMails =  TASKMAIL.UI.splitVisibleMails(keysMails, gDBView.msgFolder.URI);
				var tasksLoop = splitVisibleMails.visible.concat(splitVisibleMails.unvisible); 
				var nextTaskId = null;
				if (TASKMAIL.UILink.lastLinkedShowed == null) {
					nextTaskId = tasksLoop[0];
				} else if (TASKMAIL.Link.indexOfLink(tasksLoop, TASKMAIL.UILink.lastLinkedShowed) + 1 < tasksLoop.length) {
					// si jamais on a changé de folder, la recherche de la précédente tache
					// va probalement échoué donc indexOf = -1 et donc on prendra la 1° des tâches liées 
					nextTaskId = tasksLoop[TASKMAIL.Link.indexOfLink(tasksLoop, TASKMAIL.UILink.lastLinkedShowed) + 1];
				} else {
					nextTaskId = tasksLoop[0];
				}
				// keysMail pourrait être modifié par le changement de folder
				var keyMailToSelect   = nextTaskId.key;
				var folderURIToSelect = nextTaskId.folderURI;
				if (TASKMAIL.Link.indexOfLink(splitVisibleMails.unvisible, nextTaskId) != -1) {
					// if task from an other folder then select folder.
					if (GetSelectedMsgFolders()[0].URI != folderURIToSelect) {
							// On empeche la sortie du scope, etc.
							this.dontRefreshTaskPane = true;
							SelectFolder(folderURIToSelect);
							this.dontRefreshTaskPane = false;
					    TASKMAIL.log("after selectFolder");
					}
				}
				this.noStatusBarRefresh = true;
				gDBView.selectMsgByKey(keyMailToSelect);
				this.noStatusBarRefresh = false;
				TASKMAIL.UILink.lastLinkedShowed = nextTaskId;
			}
			TASKMAIL.UILink.refreshStatusBar("mail");
		}
	},
	
	refreshStatusBar : function (sens) {
		// cette méthode sera appelé plusieurs fois. La dernière sera à partir de showLinkedxxx.
		if (this.noStatusBarRefresh) {
			return;
		}
		TASKMAIL.log("refreshStatusBar");
		var statusbarLabel = "";
		if (sens == "task") {
			var mails = gFolderDisplay.selectedMessages;
			if (mails != null && mails.length == 1) {
				// recupére les ID de taches liées au mail
				var taskIDs = TASKMAIL.Link.getTaskIDFromMailID(gDBView.msgFolder.URI, mails[0].messageKey);
				if (taskIDs.length > 0) {
					// on a des tâches liées
					var visibleTasks = TASKMAIL.UI.splitVisibleTasks(taskIDs);
	
					var indice       = visibleTasks.visible.indexOf(TASKMAIL.UILink.lastLinkedShowed); 
					var nbLinksIn    = visibleTasks.visible.length; 
					var nbLinksOut   = visibleTasks.unvisible.length;
					statusbarLabel = TASKMAIL.UI.stringsBundle.
						getFormattedString("statusbar.text.indice", [indice + 1, nbLinksIn, nbLinksOut]);
				} else {
						statusbarLabel = TASKMAIL.UI.stringsBundle.
							getString("statusbar.text.nolink");
				}
			} else {
						statusbarLabel = TASKMAIL.UI.stringsBundle.
							getString("statusbar.text.empty");				
			}
		} else {
			var selectedTasks = TASKMAIL.UI.getSelectedTasksKeys();
			if (selectedTasks.length == 1) {
				var mailKeys = TASKMAIL.Link.getMailsFromTaskID(selectedTasks[0]);
				if (mailKeys) {
					var currentMsgFolderURI = gDBView.msgFolder.URI;
					var visibleMailKeys =  TASKMAIL.UI.splitVisibleMails(mailKeys, gDBView.msgFolder.URI);
					
					if (TASKMAIL.UILink.lastLinkedShowed != null) {
						var indice       = visibleMailKeys ? TASKMAIL.Link.indexOfLink(visibleMailKeys.visible, TASKMAIL.UILink.lastLinkedShowed) : -1;
					} else {
						var indice       = -1;
					}
					var nbLinksIn    = visibleMailKeys ? visibleMailKeys.visible.length : 0; 
					var nbLinksOut   = mailKeys.length - nbLinksIn;
					statusbarLabel = TASKMAIL.UI.stringsBundle.
						getFormattedString("statusbar.text.indice", [indice + 1, nbLinksIn, nbLinksOut]);
				} else {
					statusbarLabel = TASKMAIL.UI.stringsBundle.
						getString("statusbar.text.nolink");
				}
			} else {
				statusbarLabel = TASKMAIL.UI.stringsBundle.
						getString("statusbar.text.empty");
			}
		}
		var statusbar = document.getElementById('taskmail-statusbar.tasks');
		statusbar.setAttribute("label", statusbarLabel);
	},
	
	/**
	 * sélectionne le prochain élèment lié en fonction de la zone qui a le focus
	 * appelé par shift-L.
	 */
	selectLinked : function (event) {
		var focused = document.commandDispatcher.focusedElement;
		if (document.getElementById("taskmail-taskList") == focused) {
			TASKMAIL.UILink.selectLinkedMails();
		} else if (document.getElementById("threadTree") == focused) {
			TASKMAIL.UILink.selectLinkedTask();
		}
	},	

	/**
	 * Sélectionne les emails liés aux tâches sélectionnées. 
	 * La commande peut être invoquée sur une tâche hors du folder courant.
	 */
	selectLinkedMails : function() {
		var folder = gDBView.msgFolder;
		var tasks = TASKMAIL.UI.getSelectedTasksKeys();
		var allMails = TASKMAIL.Link.getMailsFromTaskIDsInFolder(tasks, folder.URI);
		if (allMails.length > 0) {
			TASKMAIL.log("selectLinkedMails, nb mails linked : " + allMails.length);
			gDBView.selection.clearSelection();
			for (var i = 0; i < allMails.length; i++) {
				var j = gDBView.findIndexFromKey(allMails[i], false);
				gDBView.selection.rangedSelect(j, j, true);
			}
		}
	},

	/**
	 * Sélectionne les tâches liées aux emails sélectionnées (tous). les taches
	 * déjà sélectionnées sont conservées.
	 */
	selectLinkedTask : function() {
		var temp = TASKMAIL.UI.getSelectedMailKey();
		var temp2 = new Array();
		for (var i = 0; i < temp.length; i++) {
			temp2 = temp2.concat(TASKMAIL.Link.getTaskIDFromMailID(gDBView.msgFolder.URI, temp[i]));
		}
		TASKMAIL.UI.selectTasksByKeys(temp2);
	},
	
	goFolder : function() {
		// TODO rendre entrée menu disabled if more than one task selected.
		// récup les tâches sélectionnées avant changement de vue.
		var selectedTask = TASKMAIL.UI.getSelectedTasks();
		var folderURI = selectedTask[0].folderURI;
		if (GetSelectedMsgFolders()[0].URI != folderURI) {
			// on provoquera la sortie du scope, etc.
			SelectFolder(folderURI);
		}
	}
}

if (!TASKMAIL.Link)
	TASKMAIL.Link = {};
TASKMAIL.Link = {

	Link : function(aFolderURI, aMailKey, aThreadKey, aTaskId) {
		this.folderURI = aFolderURI;
		this.key       = aMailKey;
		this.threadKey = aThreadKey;
		this.taskId    = aTaskId;
	},
	
	addLink : function(aFolderURI, aMailKey, aThreadKey, aTaskId) {
		var l = this.nbLinks;
		var aLink = new TASKMAIL.Link.Link(aFolderURI, aMailKey, aThreadKey, aTaskId);
		this.links[l] = aLink;
		this.nbLinks++;
	},

	resetLink : function() {
		TASKMAIL.log("resetLink");
		this.nbLinks = 0;
		TASKMAIL.UILink.lastLinkedShowed = null;
	},

	/**
	 * Détermine le type de lien associé à la tâche spécifié
	 * @param taskID
	 * @param taskFolderURI, string, folder de la tâche
	 * @param messageKeys, [messageKey], current selected message keys
	 * @return 3 = lien outside (au moins une liaison hors du folder de la tâche
	 *         2 = lien surligné,
	 *         1 = lien,
	 *         0 = pas de lien.
	 */
	getTaskLinkType : function(taskID, taskFolderURI, aFolderURI, messageKeys) {
		// taskID à -1 si pas de tache sélectionnée
		
		var linkWithThisMail  = false;
		var linkWithAMail     = false;
		var linkOutsideFolder = false;
		
		for (var j = 0; j < this.nbLinks; j++) {
			if (taskID == this.links[j].taskId) {
				if (this.links[j].folderURI == aFolderURI && messageKeys.indexOf(this.links[j].key) > -1) {
					linkWithThisMail = true;
				} else {
					linkWithAMail = true;
				}
				// on regarde si au moins un folder en liaison 
				// est différent du folder de la tâche
				if (taskFolderURI != this.links[j].folderURI) { 
					linkOutsideFolder = true;
				}
			}
		}
		var result = -1;
		if (linkWithThisMail) {
			result = 2;
		} else if (linkOutsideFolder) {
			result = 3;
		} else if (linkWithAMail) {
			result = 1;
		} else {
			result = 0;
		}
		return result;
	},

	/**
	 * Détermine les clé de mail correspondant à la tache spécifiée
	 * dans le folder spécifié.
	 * @param taskId    String
	 * @param folderURI String
	 * @return [link] null if no link. 
	 */
	getMailsFromTaskIDInFolder : function(taskID, folderURI) {
		var result = null;
		var nbResult = 0;
		for (var i = 0; i < this.nbLinks; i++) {
			if ((folderURI != null
			     && this.links[i].folderURI == folderURI
			     && this.links[i].taskId == taskID)
			    || (folderURI == null && this.links[i].taskId == taskID))
			{
				if (result == null) {
					result = new Array();
				}
				result[nbResult] = this.links[i];
				nbResult += 1;
			}
		}
		 TASKMAIL.log(result);
		return result;
	},

	/**
	 * Détermine les clé de mail correspondants aux tâches spécifiées
	 * dans le folder spécifié.
	 * @param taskId    [String]
	 * @param folderURI String
	 * @return [link]
	 */
	getMailsFromTaskIDsInFolder : function(taskIDs, folderURI) {
		// récupére la liste de tous les emails liés avec les tâches sélectionnées
		// en ne prenant que les emails du folder en cours de visu.
		var allMails = new Array();
		for (var i = 0; i < taskIDs.length; i++) {
			var mails = TASKMAIL.Link.getMailKeysFromTaskIDInFolder(taskIDs[i], folderURI);
			if (mails != null)
				allMails = allMails.concat(mails);
		}
		return allMails;
	},

	/**
	 * Détermine les clé de mail correspondants aux tâches spécifiées
	 * dans le folder spécifié.
	 * @param taskId    [String]
	 * @return [link]
	 */
	getMailsFromTaskIDs : function(taskIDs) {
		// récupére la liste de tous les emails liés avec les tâches sélectionnées
		// en ne prenant que les emails du folder en cours de visu.
		var allMails = new Array();
		for (var i = 0; i < taskIDs.length; i++) {
			var mails = TASKMAIL.Link.getMailKeysFromTaskIDInFolder(taskIDs[i], null);
			if (mails != null)
				allMails = allMails.concat(mails);
		}
		return allMails;
	},

	/**
	 * Détermine les clé de mail correspondant à la tache spécifiée
	 * dans le folder spécifié.
	 * @param taskID string
	 * @param folderURI string
	 * @return [int] null if empty
	 */
	getMailKeysFromTaskIDInFolder : function(taskID, folderURI) {
		var temp = this.getMailsFromTaskIDInFolder(taskID, folderURI);
		if (temp != null) {
			return temp.map(function(value, indice, array){return value.key;}); 
		} else {
			return null;
		}
	},

	/**
	 * Détermine les clé de mail correspondant à la tache spécifiée.
	 * @return [link]
	 */
	getMailsFromTaskID : function(taskID) {
		return this.getMailsFromTaskIDInFolder(taskID, null);
	},

	/**
	 * Détermine les clé de mail correspondant à la tache spécifiée.
	 * @return [int]
	 */
	getMailKeysFromTaskID : function(taskID) {
		return this.getMailKeysFromTaskIDInFolder(taskID, null);
	},

	/**
	 * détermine les tâches liées à l'email spécifié.
	 * 
	 * @param String folderURI
	 * @param String mailKey
	 * @return [link]
	 */
	getTasksFromMailID : function(aFolderURI, mailKey) {
		var result = new Array();
		var j = 0;
		for (var i = 0; i < this.nbLinks; i++) {
			if (this.links[i].folderURI == aFolderURI && this.links[i].key == mailKey) {
				result[j++] = this.links[i];
			}
		}
		return result;
	},

	/**
	 * détermine les clés de taches à partir de la clé de mail spécifiée
	 * 
	 * @param String folderURI
	 * @param String mailKey
	 * @return [int]
	 */
	getTaskIDFromMailID : function(aFolderURI, mailKey) {
		var tasks = TASKMAIL.Link.getTasksFromMailID(aFolderURI, mailKey);
		return tasks.map(function (value){return value.taskId;});
	},

	/**
	 * Check if all selected tasks are in the specified folder
	 * @param folderURI
	 * @return boolean
	 */
	allTasksInFolder : function(taskList, folderURI) {
		for (var i = 0; i < taskList.length; i++) {
			if (taskList[i].folderURI != folderURI) {
				return false;
			}
		}
		return true;
	},
	
	/**
	 * @param taskID [int] -1 si pas de tache sélectionnée
	 * @param selectedMailKey
	 * @return 3 = lien grisé, 2 = lien surligné, 1 = lien, 0 = pas de lien
	 */
	getMailLinkType : function(taskID, aFolderURI, selectedMailKey) {
		// taskID à -1 si pas de tache sélectionnée
		var direct = false;
		var undirect = false;
		var oneTaskVisible = false;
		for (var j = 0; j < this.nbLinks; j++) {
			if (aFolderURI == this.links[j].folderURI && selectedMailKey == this.links[j].key) {
				if (taskID.indexOf(this.links[j].taskId) > -1) {
					direct = true;
				} else {
					undirect = true;
				}
				if (!oneTaskVisible) {
					var temp = new Array(0);
					temp[0] = this.links[j].taskId;
					var temp2 = TASKMAIL.UI.getTaskIndexesFromTaskID(temp);
					if (temp2.length > 0) {
						oneTaskVisible = true;
					}
				}
			}
		}
		var result = direct ? 2 : !oneTaskVisible && undirect ? 3 : undirect
				? 1
				: 0;
		return result;
	},
	
	/**
	 * is the specified message has a link with a task ?
	 */
	isMessageLinked : function (aFolderURI, aMessageKey) {
		var result = false;
		for(var i=0; i<this.nbLinks; i++) {
			if (this.links[i].folderURI == aFolderURI && this.links[i].key == aMessageKey) {
				result = true;
				break;
			}
		}
		TASKMAIL.log("isMessageLinked" + aFolderURI + "," + aMessageKey + "=" + result);
		return result;
	},

	/**
	 * is the specified message as a link with the specified task ?
	 */
	isMessageLinkedWith : function (aFolderURI, aMessageKey, aTaskId) {
		var result = false;
		for(var i=0; i<this.nbLinks; i++) {
			if (this.links[i].taskId == aTaskId) {
				if (this.links[i].folderURI == aFolderURI && this.links[i].key == aMessageKey) {
					result = true;
					break;
				}
			}
		}
		return result;
	},

	/**
	 * is the specified thread has a link with a task ?
	 */
	isThreadLinked : function (aThreadKey) {
		return this.links.some(function (value, index, array) { return value.threadKey == aThreadKey; });
	},

	/**
	 * is the specified thread has a link with specified task ?
	 */
	isThreadLinkedWith : function (aThreadKey, aTaskId) {
		var result = false;
		for(var i=0; i<this.nbLinks; i++) {
			if (this.links[i].taskId == aTaskId) {
				if (this.links[i].threadKey == aThreadKey) {
					result = true;
					break;
				}
			}
		}
		return result;
	},

	/**
	 * find a link into an array links.
	 * @param links [link]
	 * @param aLink link
	 * @return int -1 if not found or links is empty
	 */
	indexOfLink : function (links, aLink) {
		var result = -1;
		for(var i=0; i<links.length; i++) {
			if (links[i].folderURI == aLink.folderURI && links[i].key == aLink.key) {
				result = i;
				break;
			}
		}
		return result;
	},

	links : new Array(),
	nbLinks : 0

}

if (!TASKMAIL.MailListener)
	TASKMAIL.MailListener = {};
TASKMAIL.MailListener = {
	folderRenamed : function(aOrigFolder, aNewFolder) {
		TASKMAIL.DB.renameFolderSQLite(aOrigFolder, aNewFolder);
		TASKMAIL.UI.refreshTaskLink();
		TASKMAIL.UI.onTaskSelect();
	},
	folderDeleted : function(aFolder) {
		// Rien lors de la suppression réelle puisque ça passe par la
		// corbeille
		// Une fois dans la corbeille, 1 supprimer => un event
		// folderDeleted,
		// un vidage de corbeille => un event de plus pour 'corbeille'
		// Un event par subFolder en partant du dessous.
		// le baseMessageURI est conforme
		// avant delete
		// mailbox-message://nobody@Local%20Folders/toto/titi
		// l'uri est modifié
		 TASKMAIL.log(aFolder.baseMessageURI);
		TASKMAIL.DB.deleteFolderSQLite(aFolder);
	},
	
	folderMoveCopyCompleted : function(aMove, aSrcFolder, aDestFolder) {
		if (aMove) {
			TASKMAIL.DB.moveFolderSQLite(aSrcFolder, aDestFolder);
		}
	},
	
	msgsMoveCopyCompleted : function(aMove, aSrcMsgs, aDestFolder, aDestMsgs) {
		if (aMove) {
			TASKMAIL.DB.msgsMoveCopyCompletedSQLite(aSrcMsgs, aDestFolder, aDestMsgs);
			TASKMAIL.UI.refreshTaskList();
		}
	},
	
	msgsDeleted : function(aMsgs) {
		TASKMAIL.DB.msgsDeletedSQLite(aMsgs);
	}
}

// set up the folder listener to point to the above function
if (!TASKMAIL.FolderCompactListener)
	TASKMAIL.FolderCompactListener = {};
TASKMAIL.FolderCompactListener = {
  OnItemAdded: function(parent, item, viewString) {},
  OnItemRemoved: function(parent, item, viewString) {},
  OnItemPropertyChanged: function(parent, item, viewString) {},
  OnItemIntPropertyChanged: function(aItem,aProperty,aOldValue,aNewValue) {},
  OnItemBoolPropertyChanged: function(item, property, oldValue, newValue) {},
  OnItemUnicharPropertyChanged: function(item, property, oldValue, newValue) {},
  OnItemPropertyFlagChanged: function(item, property, oldFlag, newFlag) {},
  OnItemEvent: function(item, event) {
  	// sur le compactage d'au folder quelconque, on lance un refresh des taches 
  	// car les messages ont pus changés.
  	if (event.toString() == "CompactCompleted") {
  		TASKMAIL.log("compact completed on folder " + item.URI);
  		TASKMAIL.UI.refreshTaskList();
  	}
  },
  OnFolderLoaded: function(aFolder) {},
  OnDeleteOrMoveMessagesCompleted: function( aFolder) {}
}

// besoin de passer par le load de la fenêtre sinon ça plante thunderbird
// (peut-être UI pas prête)
window.addEventListener("load", function(e) {
			TASKMAIL.UI.init(e);
		}, false);

if (!TASKMAIL.UIDrag)
	TASKMAIL.UIDrag = {};
TASKMAIL.UIDrag= {
	onStartTask : function(event, aTask){
		TASKMAIL.log("onStartTask");
		event.dataTransfer.setData('application/taskmail', "task");
	},
	
	onOverTask : function (event) {
		TASKMAIL.log("onOverTask");
//		for(var i=0; i<event.dataTransfer.types.length; i++) {
//			TASKMAIL.log(event.dataTransfer.types[i]);
//		}
		var isMail = event.dataTransfer.types.contains("text/x-moz-message") ||
								 // autorise le drag d'un paragraphe de corps de message.
		             event.dataTransfer.types.contains("text/_moz_htmlcontext");
  	if (isMail)
  		event.preventDefault();
	},
	
	onDropTask : function(event,taskId) {		
		TASKMAIL.log("onDropTask" + event.dataTransfer.types);
		var isMessage = event.dataTransfer.types.contains("text/x-moz-message") ||
		                event.dataTransfer.types.contains("text/_moz_htmlcontext");
  	if (isMessage) {
  		var taskList = document.getElementById("taskmail-taskList");
			var index = taskList.treeBoxObject.getRowAt(event.clientX, event.clientY);
			if (index != -1) {
				var row = taskList.contentView.getItemAtIndex(index);
				var taskId = row.firstChild.getAttribute("pk");
				var folder = row.firstChild.getAttribute("folderURI");
				var task = new TASKMAIL.Task(taskId, folder, null, null, null, null);
				var tasks = new Array(task);
				TASKMAIL.UILink.linkTask("task", tasks)
			} else {
			 // Drop on no task => create new one with link.
			 TASKMAIL.UI.beginAddTaskWithLink();
      }
		}			
	},
	
	onOverMail : function (event) {
		var isTask = event.dataTransfer.types.contains("application/taskmail");
  	if (isTask) {
  		TASKMAIL.log("onOverMail , is a task");
  		event.preventDefault();
  	}
	},
	
	onDropMail : function (event) {
		// ThreadPaneOnDrop is called before this function.
		// It isn't very clean but it works.
		var isTask = event.dataTransfer.types.contains("application/taskmail");
  	if (isTask) {
			var row = event.currentTarget.treeBoxObject.getRowAt(event.clientX, event.clientY);
			var msgKey = gDBView.getMsgHdrAt(row);
			var mails = new Array(1);
			mails[0] = msgKey;
			TASKMAIL.UILink.linkTask("mail", mails);
  	}
	},
	
	onOverFolder : function (event) {
		var isTask = event.dataTransfer.types.contains("application/taskmail");
  	if (isTask) {
  		event.preventDefault();
  	}
	},
	
	onDropFolder : function (event) {
		var isTask = event.dataTransfer.types.contains("application/taskmail");
  	if (isTask) {
  		var row = event.currentTarget.treeBoxObject.getRowAt(event.clientX, event.clientY);
			var destFolder = gFolderTreeView.getFolderForIndex(row);
			TASKMAIL.UI.moveTask(destFolder);
  	}
	}
}