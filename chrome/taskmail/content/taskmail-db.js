if (!TASKMAIL)
	var TASKMAIL = {};
if (!TASKMAIL.DB)
	TASKMAIL.DB = {};

TASKMAIL = {
	
	done_state : 4,
	
	Task : function(aId, aFolderURI, aFolderName, aTitle, aDesc, aState, aPriority,
	                aCreateDate, aDueDate, aCompleteDate) {
		this.id             = aId;							// int
		this.folderURI      = aFolderURI;
		this.folderName     = aFolderName;
		this.title          = aTitle;
		this.desc           = aDesc;
		this.state          = aState;						// State (code de l'état) ; 4 = TASKMAIL.done_state = done.
		this.priority       = aPriority;
		this.createDate     = aCreateDate;			// Les dates sont des Date Javascript, null possible.
		this.dueDate        = aDueDate;
		this.completeDate   = aCompleteDate;
	},
	
	/**
	 * sort tow tasks depending of a given property and order
	 * @param a Task
	 * @param b Task
	 * @param property String "priority", "dueDate"
	 * @param sens String "natural", "descending", "ascending"
	 */
	sortTask : function (a, b, property, sens) {
		var valueA = a[property];
		var valueB = b[property];
		if (valueA == valueB) return 0; 
		else if (valueA < valueB) return (sens == "ascending") ? -1 : 1; 
		else return (sens == "ascending") ? 1 : -1;
	},
	
	/**
	 * return true if the task has a due date in the next 7 days.
	 * @param Task
	 * @return boolean
	 */
	isNext : function (aTask) {
		if (aTask == null) return false;
		return aTask.dueDate >= (new Date() - 1*24*60*60*1000) && (aTask.dueDate - 7*24*60*60*1000) <= new Date();  
	},
	
	/**
	 * return true if the task has a due date overdued.
	 * @param Task
	 * @return boolean
	 */
	isOverdue : function (aTask) {
		if (aTask == null) return false;
		return (aTask.dueDate <= (new Date() - 1*24*60*60*1000));  
	},
	
	Content : function() {
		this.invisibleTasksCount  = 0;
		this.tasks       = new Array();
		this.subContents = new Array();
		this.folderName  = "";
	},

	consoleService : Components.classes["@mozilla.org/consoleservice;1"]
	.getService(Components.interfaces.nsIConsoleService),
			
	log : function (message) {
		if (false) {
			this.consoleService.logStringMessage(message);
		}
	}
}

TASKMAIL.DB = {

	getTaskListWhereClause : function (stateFilter, viewFilter, folderMsg, mailId, folder, text) {
		var sql = "";
    if (viewFilter == TASKMAIL.UI.VIEW_FILTER_HOTLIST) {
			sql += " from tasks where 1=1 ";
			sql += " and (tasks.priority >= 7 or tasks.dueDate <= date('now','7 days')) and tasks.state in ('1','2') ";
    } else {
	    if (viewFilter == TASKMAIL.UI.VIEW_FILTER_MESSAGE && mailId != null) {
				// recherche par mail (donc non recurssive)
				sql += " from tasks, links where tasks.rowid = links.taskId ";
				sql += " and links.folderURI = :folderURI and links.messageId = :mailId "; 
	    } else if ((viewFilter == TASKMAIL.UI.VIEW_FILTER_FOLDER || viewFilter == TASKMAIL.UI.VIEW_FILTER_SUBFOLDERS) 
	               && folder != null) {
				// sinon recherche par folder
				sql += " from tasks where 1=1 ";
				if (viewFilter != TASKMAIL.UI.VIEW_FILTER_SUBFOLDERS) {
					sql += " and folderURI = :folderURI "; 
				} else {
					sql += " and ( folderURI = :folderURI or folderURI like :subfolderURI escape \"&\" ) "; 
				}                                       
	    } else {
				// sinon recherche de tous les folders
				sql += " from tasks where 1=1 ";
	    }
			// quelque soit le type de recherche (email ou folder) on
			// applique le filtre d'état
			if (stateFilter != null && stateFilter != "") {
				var stateExp = "";
				for (var i = 0; i < stateFilter.length; i++) {
					if (i > 0) {
						stateExp += ",";
					}
					stateExp += stateFilter.charAt(i);
				}
				sql += " and tasks.state in (" + stateExp + ") ";
			}
			if (text != null && text != "") {
				sql += " and (title like :text or desc like :desc) ";
			}
    }
		return sql;
	},
	
	bindTaskListParameters: function (stat, i, viewFilter, folderMsg, mailId, folder, text) {
		if (viewFilter != TASKMAIL.UI.VIEW_FILTER_HOTLIST) {
			if (viewFilter == TASKMAIL.UI.VIEW_FILTER_MESSAGE && mailId != null) {
				var msgFolderURI = folderMsg.URI;
				stat.bindStringParameter(i, msgFolderURI); i++;
				stat.bindStringParameter(i, mailId); i++;
			} else if ((viewFilter == TASKMAIL.UI.VIEW_FILTER_FOLDER || viewFilter == TASKMAIL.UI.VIEW_FILTER_SUBFOLDERS) 
	               && folder != null) {
				var folderURI = folder.URI;
				var argValue = folderURI;
				stat.bindStringParameter(i, argValue); i++;
				if (viewFilter == TASKMAIL.UI.VIEW_FILTER_SUBFOLDERS) {
					argValue = folderURI.replace("%","&%") + "/%";
  				stat.bindStringParameter(i, argValue); i++;
				}
			}
			if (text != null && text != "") {
				stat.bindStringParameter(i, "%" + text + "%"); i++;
				stat.bindStringParameter(i, "%" + text + "%"); i++;
			}
		}
	},
			
	/**
	 * @param folderMsg nsiMsgFolder (use URI) use with mailId if viewFilter is Message. 
	 * @param mailId nsIMsgDBHdr.messageKey (qsdqsdqsdqsdqsd)
	 * @param folder nsiMsgFolder (use URI) folder to retreive if viewfilder is folder or subfolders.
	 * @param stateFilter string (or null) Concatenation of state to retrive "12345" 
	 * @param viewFilter int 
	 * @param text string (or null)
	 * @return array[Task]
	 */
	getTaskListSQLite : function(folderMsg, mailId, folder, stateFilter, viewFilter, text) {
		TASKMAIL.log("getTaskListSQLite");
		var result = new Array();
		try {
			var sql = "select tasks.rowid, title, state, desc, priority, createDate, dueDate, completeDate, tasks.folderURI ";
			sql += this.getTaskListWhereClause(stateFilter, viewFilter, folderMsg, mailId, folder, text);
      if (   viewFilter == TASKMAIL.UI.VIEW_FILTER_FOLDER
			    || viewFilter == TASKMAIL.UI.VIEW_FILTER_SUBFOLDERS
			    || viewFilter == TASKMAIL.UI.VIEW_FILTER_ALL_FOLDERS
			    || viewFilter == TASKMAIL.UI.VIEW_FILTER_HOTLIST) {
				sql += " order by folderURI";
			}
			var stat = this.dbConnection.createStatement(sql);
			this.bindTaskListParameters(stat, 0, viewFilter, folderMsg, mailId, folder, text);
			while (stat.executeStep()) {
				var id = stat.getInt32(0);
				var title = stat.getString(1);
				var state = stat.getString(2);
				var desc  = stat.getString(3);
				var prio  = stat.getInt32(4);
				var createDate     = this.convertSQLiteToDate(stat.getString(5));
				var dueDate        = this.convertSQLiteToDate(stat.getString(6));
				var completeDate   = this.convertSQLiteToDate(stat.getString(7));
				var taskFolder     = stat.getString(8);
				try {
					var prettyName = GetMsgFolderFromUri(taskFolder, false).prettyName;
				} catch (err) {
					var prettyName = "";
					Components.utils.reportError("getTaskListSQLite, taskFolder=" + taskFolder + "erreur=" + err);
				}
				var task = new TASKMAIL.Task(id, taskFolder, prettyName, title, desc, state, prio,
				                             createDate, dueDate, completeDate);
				result.push(task);
			}
		} catch (err) {
			Components.utils.reportError("getTaskListSQLite " + err);
		}
		return result;
	},
	
	getTaskDetailSQLite : function(pk) {
		TASKMAIL.log("getTaskDetailSQLite");
		var result = null;
		try {
			var stat = this.dbConnection
					.createStatement("select rowid, title, state, desc, priority, createDate, dueDate, completeDate, folderURI from tasks where rowid = :pk");
			stat.bindInt32Parameter(0, pk);
			while (stat.executeStep()) {
				var id = stat.getInt32(0);
				var title = stat.getString(1);
				var state = stat.getString(2);
				var desc = stat.getString(3);
				var prio = stat.getInt32(4);
				var createDate     = this.convertSQLiteToDate(stat.getString(5));
				var dueDate        = this.convertSQLiteToDate(stat.getString(6));
				var completeDate   = this.convertSQLiteToDate(stat.getString(7));
				var folderURI      = stat.getString(8);
				result = new TASKMAIL.Task(id, folderURI, null, title, desc, state, prio, 
				                           createDate, dueDate, completeDate);
			}
		} catch (err) {
			Components.utils.reportError("getTaskDetailSQLite " + err);
		}
		return result;
	},

	/**
	 * La date de création est celle de la base.
	 */
	addTaskSQLite : function(aTask) {
		TASKMAIL.log("addTaskSQLite");
		var folderURI = aTask.folderURI;
		var stat = this.dbConnection
				.createStatement("insert into tasks (title, state, desc, folderURI, priority, createDate, dueDate, completeDate) values (:titleInput, :stateInput, :desc, :folderURI, :priority, :createDate, :dueDate, :completeDate)");
		stat.bindStringParameter(0, aTask.title);
		stat.bindStringParameter(1, aTask.state);
		stat.bindStringParameter(2, aTask.desc);
		stat.bindStringParameter(3, aTask.folderURI);
		stat.bindInt32Parameter (4, aTask.priority);
		if (aTask.createDate != null) stat.bindStringParameter(5, this.convertDateToSQLite(aTask.createDate));
		if (aTask.dueDate != null) stat.bindStringParameter(6, this.convertDateToSQLite(aTask.dueDate));
		if (aTask.completeDate != null) stat.bindStringParameter(7, this.convertDateToSQLite(aTask.completeDate));
		stat.execute();
	},

	/**
	 * La date de création n'est pas modifiée.
	 */
	updateTaskSQLite : function(aTask) {
		TASKMAIL.log("updateTaskSQLite");
		var stat = this.dbConnection
				.createStatement("update tasks set title = :title, state = :state, desc = :desc, priority = :priority, createDate = :create_d, dueDate = :due_d, completeDate = :complete_d where rowid = :pk");
		var createDate = this.convertDateToSQLite(aTask.createDate);
		var dueDate = this.convertDateToSQLite(aTask.dueDate);
		var completeDate = this.convertDateToSQLite(aTask.completeDate);				
		stat.bindStringParameter(0, aTask.title);
		stat.bindStringParameter(1, aTask.state);
		stat.bindStringParameter(2, aTask.desc);
		stat.bindInt32Parameter (3, aTask.priority);
		if (createDate != null) stat.bindStringParameter(4, createDate);
		if (dueDate != null) stat.bindStringParameter(5, dueDate);
		if (completeDate != null) stat.bindStringParameter(6, completeDate);
		stat.bindInt32Parameter (7, aTask.id);
		stat.execute();
	},

	updateTaskProritySQLite : function(taskIdArray, priority) {
		TASKMAIL.log("updateTaskProritySQLite");
		try {
			var stat = this.dbConnection
				.createStatement("update tasks set priority = :p where rowid = :pk");
			this.dbConnection.beginTransaction();
			for(var i=0; i<taskIdArray.length; i++) {
				stat.bindInt32Parameter(0, priority);
				stat.bindInt32Parameter(1, taskIdArray[i].id);
				stat.execute();
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("updateTaskProritySQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},
	
	incrementTaskProritySQLite : function(taskIdArray) {
		TASKMAIL.log("incrementTaskProritySQLite");
		try {
			var stat = this.dbConnection
				.createStatement("update tasks set priority = priority  + 1 where rowid = :pk and priority < 9");
			this.dbConnection.beginTransaction();
			for(var i=0; i<taskIdArray.length; i++) {
				stat.bindInt32Parameter(0, taskIdArray[i].id);
				stat.execute();
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("incrementTaskProritySQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},
	
	decrementTaskProritySQLite : function(taskArray) {
		TASKMAIL.log("decrementTaskProritySQLite");
		try {
			var stat = this.dbConnection
				.createStatement("update tasks set priority = priority  - 1 where rowid = :pk and priority > 0");
			this.dbConnection.beginTransaction();
			for(var i=0; i<taskArray.length; i++) {
				stat.bindInt32Parameter(0, taskArray[i].id);
				stat.execute();
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("decrementTaskProritySQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	/**
	 * Change state and complete date if change to 'done'.
	 * @param taskIdArray Array[int] tasks id to update
	 * @param state int state code
	 */
	updateStateTaskSQLite : function (taskIdArray, state) {
		TASKMAIL.log("updateStateTaskSQLite");
		try {
			this.dbConnection.beginTransaction();
			var statState = this.dbConnection
				.createStatement("update tasks set state = :state where rowid = :pk");
			var statDate = this.dbConnection
				.createStatement("update tasks set completeDate = current_date where rowid = :pk");
			for(var i=0; i<taskIdArray.length; i++) {
				statState.bindStringParameter(0, state);
				statState.bindInt32Parameter(1, taskIdArray[i]);
				statState.execute();
				if (state == TASKMAIL.done_state) {
					statDate.bindInt32Parameter(0, taskIdArray[i]);
					statDate.execute();
				}
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("updateStateTaskSQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	removeTaskAndLinkSQLite : function(taskId) {
		TASKMAIL.log("removeTaskAndLinkSQLite");
		var stat = this.dbConnection
				.createStatement("delete from tasks where rowid = :taskId");
		stat.bindInt32Parameter(0, taskId);
		stat.execute();
		var stat2 = this.dbConnection
				.createStatement("delete from links where taskId = :taskId");
		stat2.bindInt32Parameter(0, taskId);
		stat2.execute();
	},

	/**
	 * @param msg nsIMsgDBHdr a message.
	 */
	linkTaskSQLite : function(taskId, msg) {
		TASKMAIL.log("linkTaskSQLite");
   	var messageId = msg.folder.GetMessageHeader(msg.messageKey).messageId;
   	var stat = TASKMAIL.DB.dbConnection
				.createStatement("insert into links (folderURI, messageId, taskId) values (:folderURI, :mailId, :taskId)");
		stat.bindStringParameter(0, msg.folder.URI);
		stat.bindStringParameter(1, messageId);
		stat.bindInt32Parameter(2, taskId);
		stat.execute();
	},

	/**
	 * detruit les lients
	 * 
	 * @param msg
	 *            a message.
	 * @param taskId
	 *            a TaskId.
	 * @return
	 */
	unlinkTaskSQLite : function(msg, taskId) {
	TASKMAIL.log("unlinkTaskSQLite");
   	var messageId = msg.folder.GetMessageHeader(msg.messageKey).messageId; 
   	var stat = this.dbConnection
				.createStatement("delete from links where folderURI = :folderURI and messageId = :MAIL_ID and taskId = :TASK_ID");
		stat.bindStringParameter(0, msg.folder.URI);
		stat.bindStringParameter(1, messageId);
		stat.bindInt32Parameter(2, taskId);
		stat.execute();
	},

	/**
	 * remonte touts les liens de toutes les taches du folder fourni
	 * (folder, subfolders, all folders). 
	 */
	getLinkSQLite : function(msgFolder, taskFolder, viewFilter) {
		TASKMAIL.log("getLinkSQLite,msgFolderName="+msgFolder.URI+"taskFolderName="+taskFolder.URI);
		try {
			// remonte tous les liens avec les messages en cours (ceux du folder)
			// et remonte tous les liens avec les tâche visualisées.
			// les liens doivent être remonté dans l'ordre : d'abord ceux du folder
			// courant puis les autres par ordre de folder.
			var sql = "select links.folderURI, messageId, taskId, links.rowid from links where links.folderURI = :folder_URI ";
			sql += "union select links.folderURI, messageId, taskId, links.rowid from links where links.taskId in ( select rowid ";
			sql += this.getTaskListWhereClause(null, viewFilter, null, null, taskFolder, null);
			sql += " ) order by links.rowid";
			var stat = this.dbConnection.createStatement(sql);
			var msgFolderURI = msgFolder.URI;
			stat.bindStringParameter(0, msgFolderURI);
			this.bindTaskListParameters(stat, 1, viewFilter, null, null, taskFolder, null);
			while (stat.executeStep()) {
				var messageFolderURI =  stat.getString(0);
				var messageId =  stat.getString(1);
				var taskId = stat.getInt32(2);
				try {
					var folderDB = GetMsgFolderFromUri(messageFolderURI, false); 
					var message = folderDB.msgDatabase.getMsgHdrForMessageID(messageId);
					var messageKey = message.messageKey;
					var threadKey = message.threadId;
					TASKMAIL.log("messageId=" + messageId + "messageKey=" + messageKey);
				} catch (err) {
					Components.utils.reportError("getLinkSQLite, problème récup messageId=" + messageId + 
						", links.folderURI=" + messageFolderURI + ", taskId="+stat.getInt32(2));   
//          var statPurge = this.dbConnection.createStatement("delete from links where folderURI = :FOLDER_URI and messageId = :MESSAGE_ID and taskId = :TASK_ID"); 
//					statPurge.bindStringParameter(0, messageFolderURI);
//          statPurge.bindStringParameter(1, messageId);
//          statPurge.bindInt32Parameter(2, taskId);
//          statPurge.execute();
//          Components.utils.reportError("getLinkSQLite, Purge réalisée");   
          continue;
				}
				TASKMAIL.log("getLinkSQLite:" + messageFolderURI + "," + messageId + "," + stat.getInt32(2)
					+ "," + stat.getInt32(2));				
				TASKMAIL.Link.addLink(messageFolderURI,
				                      messageKey,
				                      threadKey,
				                      stat.getInt32(2));
			}
			TASKMAIL.log("getLinkSQLite,result count="+TASKMAIL.Link.nbLinks);
		} catch (err) {
			Components.utils.reportError("getLinkSQLite, folder=" + folder == null ? "null" : folderURI + ", erreur=" + err);
		}
	},

	renameFolderSQLite : function(aOrigFolder, aNewFolder) {
		TASKMAIL.log("renameFolderSQLite");
		// rename folder then rename subFolders
		try {
			this.dbConnection.beginTransaction();
			var origFolderName = aOrigFolder.name;
			// le origFolder n'a pas d'attribut parent
			var newFolderName = aNewFolder.name;
			var newFolderURI = aNewFolder.URI;

			var origSubFolderURI = aOrigFolder.URI;
			var newSubFolderURI = aNewFolder.URI;

			var sql = "update tasks set folderURI = replace(folderURI, :old, :new) where (folderURI = :equal) or (folderURI like :like)";
			var stat4 = this.dbConnection.createStatement(sql);
			stat4.bindStringParameter(0, origSubFolderURI);
			stat4.bindStringParameter(1, newSubFolderURI);
			stat4.bindStringParameter(2, origSubFolderURI);
			stat4.bindStringParameter(3, origSubFolderURI + "/%");
			stat4.execute();

			sql = "update links set folderURI = replace(folderURI, :old, :new) where (folderURI = :equal) or (folderURI like :like)";
			var stat5 = this.dbConnection.createStatement(sql);
			stat5.bindStringParameter(0, origSubFolderURI);
			stat5.bindStringParameter(1, newSubFolderURI);
			stat5.bindStringParameter(2, origSubFolderURI);
			stat5.bindStringParameter(3, origSubFolderURI + "/%");
			stat5.execute();
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("renameFolder" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	/**
	 * Efface un folder cad les taches et liens associés. n'efface pas les sous
	 * folder car l'event folderDeleted est appelé plusieurs fois
	 */
	deleteFolderSQLite : function(aFolder) {
		TASKMAIL.log("deleteFolderSQLite");
		try {
			this.dbConnection.beginTransaction();

			var folderURI = aFolder.URI;
			TASKMAIL.log("deleteFolderSQLite"
					+ folderURI);

			var sql = "delete from tasks where folderURI = :URI";
			var stat2 = this.dbConnection.createStatement(sql);
			stat2.bindStringParameter(0, folderURI);
			stat2.execute();

			sql = "delete from links where folderURI = :URI";
			var stat3 = this.dbConnection.createStatement(sql);
			stat3.bindStringParameter(0, folderURI);
			stat3.execute();

		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("renameFolder" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	/**
	 * pas d'event pour les sous-folders
	 */
	moveFolderSQLite : function(aSrcFolder, aDestFolder) {
		TASKMAIL.log("moveFolderSQLite");
		try {
			var oldParentURI = aSrcFolder.parent != null
					? aSrcFolder.parent.URI
					: aSrcFolder.URI;
			var newParentURI = aDestFolder.URI;

			this.dbConnection.beginTransaction();

			var sql = "update tasks set folderURI = replace(folderURI, :OLD_URI,:NEW_URI) where (folderURI = :equal) or (folderURI like :OLD_LIKE_URI)";
			var stat = this.dbConnection.createStatement(sql);
			stat.bindStringParameter(0, oldParentURI);
			stat.bindStringParameter(1, newParentURI);
			stat.bindStringParameter(2, aSrcFolder.URI);
			stat.bindStringParameter(3, aSrcFolder.URI + "/%");
			stat.execute();

			sql = "update links set folderURI = replace(folderURI, :OLD_URI, :NEW_URI) where (folderURI = :equal) or (folderURI like :OLD_LIKE_URI)";
			var stat2 = this.dbConnection.createStatement(sql);
			stat2.bindStringParameter(0, oldParentURI);
			stat2.bindStringParameter(1, newParentURI);
			stat2.bindStringParameter(2, aSrcFolder.URI);
			stat2.bindStringParameter(3, aSrcFolder.URI + "/%");
			stat2.execute();
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("moveFolderSQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	/**
	 * Supprime les tâches liées directes (celles dans le folder du message).
	 * @param aMsgs An array of the message headers about to be deleted
	 */
	msgsDeletedSQLite : function(aMsgs) {
		TASKMAIL.log("msgsDeletedSQLite");
		try {
			this.dbConnection.beginTransaction();
			var TASK_SQL = "delete from tasks where rowid in (select taskId from links where folderURI = :URI and messageId = :ID) and folderURI = :TASK_FOLDER_URI";
			var LINK_SQL = "delete from links where folderURI = :URI and messageId = :ID";
			var msgEnum = aMsgs.enumerate();
			while (msgEnum.hasMoreElements()) {
				var msg = msgEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
				var msgKey = msg.messageKey;
				// folder = xxx/Trash.
				var folderURI = msg.folder.URI;
				var messageId = msg.folder.GetMessageHeader(msg.messageKey).messageId;
				TASKMAIL.log("msgsDeletedSQLite" + folderURI + "," + msgKey + "," + messageId);
				var stat = this.dbConnection.createStatement(TASK_SQL);
				stat.bindStringParameter(0, folderURI);
				stat.bindStringParameter(1, messageId);
				stat.bindStringParameter(2, folderURI);
				stat.execute();

				var stat2 = this.dbConnection.createStatement(LINK_SQL);
				stat2.bindStringParameter(0, folderURI);
				stat2.bindStringParameter(1, messageId);
				stat2.execute();
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("msgsDeletedSQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	/**
	 * Déplacement des mails et des taches directement liées (celles dans le même folder que le message).
	 * @param aSrcMsgs    An array of the message headers in the source folder
	 * @param aDestFolder The folder these messages were moved to.
	 * @param aDestMsgs   Present only for local folder moves, it provides the list of
	 *                    target message headers.
	 */
	msgsMoveCopyCompletedSQLite : function(aSrcMsgs, aDestFolder, aDestMsgs) {
		TASKMAIL.log("msgsMoveCopyCompletedSQLite");
		try {
			var TASK_SQL = "update tasks set folderURI = :NEW_URI where rowid in (select taskId from links where folderURI = :OLD_URI and messageId = :OLD_MSG_KEY) and folderURI = :TASK_FOLDER_URI";
			var LINK_SQL = "update links set folderURI = :NEW_URI where folderURI = :OLD_URI and messageId = :OLD_MSG_KEY";

			var srcEnum = aSrcMsgs.enumerate();
			var destEnum = aDestMsgs.enumerate();

			while (srcEnum.hasMoreElements()) {
				var srcMsg = srcEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
				TASKMAIL.log(srcMsg.messageKey);
				var destMsg = destEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
				TASKMAIL.log(destMsg.messageKey);
				var messageId = destMsg.folder.GetMessageHeader(destMsg.messageKey).messageId;
				
				TASKMAIL.log("msgsMoveCopyCompletedSQLite"
								+ destMsg.folder.URI + "," + srcMsg.folder.URI + "," + srcMsg.messageKey
								+ "," + messageId);

				
				var stat = this.dbConnection.createStatement(TASK_SQL);
				stat.bindStringParameter(0, destMsg.folder.URI);
				stat.bindStringParameter(1, srcMsg.folder.URI);
				stat.bindStringParameter(2, messageId);
				stat.bindStringParameter(3, srcMsg.folder.URI);
				stat.execute();

				var stat2 = this.dbConnection.createStatement(LINK_SQL);
				stat2.bindStringParameter(0, destMsg.folder.URI);
				stat2.bindStringParameter(1, srcMsg.folder.URI);
				stat2.bindStringParameter(2, messageId);
				stat2.execute();
			}
		} catch (err) {
			// this.dbConnection.rollbackTransaction();
			Components.utils.reportError("msgsDeletedSQLite" + err);
		} finally {
			// this.dbConnection.commitTransaction();
		}
	},

	/**
	 * @param aSrcFolder  A source folder from to move the task
	 * @param aTask       A task to move
	 * @param aDestFolder A destination folder
	 * @todo Pas encore de gestion du déplacement de tache avec des liens. Gérer
	 *       plusieurs taches
	 */
	taskMoveSQLite : function(aTaskID, aDestFolder) {
		TASKMAIL.log("taskMoveSQLite");
		var SQL = "update tasks set folderURI = :NEW_URI where rowid = :TASK_ID";
		var stat = this.dbConnection.createStatement(SQL);
		stat.bindStringParameter(0, aDestFolder.URI);
		stat.bindStringParameter(1, aTaskID);
		stat.execute();
		TASKMAIL.log("taskMoveSQLite " + aTaskID + " dans " + aDestFolder.URI);
	},

	onLoad : function() {
		// initialization code
		this.initialized = true;
		this.dbInit();
		this.dbUpgrade();
	},

	dbConnection : null,

	/**
	 * La pk de la table est le rowid interne de sqlite
	 * createDate, dueDate, completeDate sont au format YYYY-MM-DD
	 */
	dbSchema : {
		tables : {
			tasks : "folderURI TEXT, title TEXT NOT NULL, state TEXT, desc TEXT, priority INTEGER, createDate TEXT, dueDate TEXT, completeDate TEXT",
			links : "folderURI TEXT, messageId TEXT, taskId NUMBER",
			model_version : "version NUMERIC"
		}
	},

	dbInit : function() {

		var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties);

		// ne pas mettre la base dans le répertoire de l'extension sinon elle serait perdue
		// durant un upgrade.
		var dbFile = dirService.get("ProfD", Components.interfaces.nsIFile);
		dbFile.append("tasks.sqlite");

		var dbService = Components.classes["@mozilla.org/storage/service;1"]
				.getService(Components.interfaces.mozIStorageService);

		var dbConnection;

		if (!dbFile.exists()) {
			dbConnection = this._dbCreate(dbService, dbFile);
			this._dbInitTables(dbConnection);
		} else {
			dbConnection = dbService.openDatabase(dbFile);
		}
		this.dbConnection = dbConnection;
	},

	targetVersion : 7,
	
	dbUpgrade : function() {
		try {
			this.dbConnection.beginTransaction();
			var currentVersion = 0;
			
			var stat = this.dbConnection
					.createStatement("select version from model_version");
			try {
				stat.executeStep();
				currentVersion = stat.getInt32(0);
			} catch (err) {
				stat = this.dbConnection
						.createStatement("CREATE TABLE model_version (version NUMERIC)");
				stat.execute();
				stat = this.dbConnection
						.createStatement("insert into model_version values (:version)");
				stat.bindInt32Parameter(0, 3);
				stat.execute();
				currentVersion = 3;
			}
			if (currentVersion < this.targetVersion) {
				var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties);
				var dbFile = dirService.get("ProfD", Components.interfaces.nsIFile);
				dbFile.append("tasks.sqlite");
				alert("Upgrade of db model needed. A backup will be made of " + dbFile.path);
				// Sauvegarde de la base.
				dbFile.copyTo(null, "tasks.sqlite" + ".backup." + currentVersion);
			}
			if (currentVersion < 4) {
				this.dbUpgrade4();
			}
			if (currentVersion < 5) {
				this.dbUpgrade5();
			} 
			if (currentVersion < 6) {
				this.dbUpgrade6();
			} 
			if (currentVersion < 7) {
				this.dbUpgrade7();
			} 
			if (currentVersion < this.targetVersion) {
				stat = this.dbConnection
						.createStatement("update model_version set version = :version");
				stat.bindInt32Parameter(0, this.targetVersion);
				stat.execute();
				alert("Upgrade successful.");
			}
		} catch (err) {
			Components.utils.reportError("dbUpgrade " + err);
			alert("Upgrade problem. Consult Error console for details.");
			this.dbConnection.rollbackTransaction();
		} finally {
			this.dbConnection.commitTransaction();
		}
	},

	dbUpgrade4 : function() {
		var stat = this.dbConnection
				.createStatement("update tasks set folderURI = replace(folderURI,'mailbox-message:','mailbox:')");
		stat.execute();
		stat = this.dbConnection
				.createStatement("update links set folderURI = replace(folderURI,'mailbox-message:','mailbox:')");
		stat.execute();
	},
	
	dbUpgrade5 : function() {
		var stat = this.dbConnection
				.createStatement("alter table tasks add column priority INTEGER DEFAULT (5)");
		stat.execute();
	},
	
	dbUpgrade6 : function() {
		TASKMAIL.log("update messageKey into messageId");
		var statAlter = this.dbConnection
				.createStatement("alter table links add column messageId TEXT");
		statAlter.execute();
		var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Components.interfaces.nsIMsgAccountManager);
		var accounts = acctMgr.accounts;
		for (var i = 0; i < accounts.Count(); i++) {
		  var account = accounts.QueryElementAt(i, Components.interfaces.nsIMsgAccount);
		  var rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder
		  this.dbUpgrade6Folder(rootFolder);
		}
	},
	
	dbUpgrade6Folder : function(folder) {
		TASKMAIL.log(folder.prettiestName);
	  var stat = this.dbConnection
			.createStatement("select mailId from links where folderURI = :FOLDER_URI");
		stat.params.FOLDER_URI = folder.URI;
	  while (stat.executeStep()) {
	  	var messageKey =  stat.getInt64(0);
	  	try {
	  		var messageHdr = folder.GetMessageHeader(messageKey);
	  		var messageId = messageHdr.messageId;
		  	TASKMAIL.log("key="+messageKey+"Id trouv�=" + messageId);
		  	var statUpdate = this.dbConnection
				.createStatement("update links set messageId = :id where folderURI = :folderURI and mailId = :key");
				statUpdate.params.id = messageId;
				statUpdate.params.folderURI = folder.URI;
				statUpdate.params.key = messageKey;
				statUpdate.execute();
	  	} catch (err) {
	  		TASKMAIL.log("messageKey introuvable, key=" + messageKey);
	  		var statDelete = this.dbConnection
				.createStatement("delete from links where folderURI = :FOLDER_URI and mailId = :MAIL_ID");
				statDelete.params.FOLDER_URI = folder.URI;
				statDelete.params.MAIL_ID = messageKey;
				statDelete.execute();
	  	}
	  }
		if (folder.hasSubFolders) {
			var subFolders = folder.subFolders; // nsIMsgFolder
		    while(subFolders.hasMoreElements()) {
		      var subfolder = subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
		      this.dbUpgrade6Folder(subfolder);
		    }
			}
	},

	/**
	 * rajout dates avec initilisation
	 */
	dbUpgrade7 : function() {
		this.dbConnection.executeSimpleSQL("alter table tasks add column createDate TEXT");
		this.dbConnection.executeSimpleSQL("alter table tasks add column dueDate TEXT");
		this.dbConnection.executeSimpleSQL("alter table tasks add column completeDate TEXT");
		this.dbConnection.executeSimpleSQL("update tasks set createDate = current_date");
		this.dbConnection.executeSimpleSQL("update tasks set completeDate = current_date where state = '" + TASKMAIL.done_state + "'");
	},
	
	_dbCreate : function(aDBService, aDBFile) {
		var dbConnection = aDBService.openDatabase(aDBFile);
		this._dbCreateTables(dbConnection);
		return dbConnection;
	},

	_dbCreateTables : function(aDBConnection) {
		for (var name in this.dbSchema.tables)
			aDBConnection.createTable(name, this.dbSchema.tables[name]);
	},

	_dbInitTables : function(connexion) {
		var stat = connexion
				.createStatement("insert into model_version values (:version)");
		stat.bindInt32Parameter(0, this.targetVersion);
		stat.execute();
		TASKMAIL.log("Database initialisation successful.");
	},

	/**
	 * convert SQLite string date (YYYY-MM-DD) to javascript Date.
	 * if null returns null.  
	 */
	convertSQLiteToDate : function(aStringDate) {
		if (aStringDate != null) {
			var year  = parseInt(aStringDate.substring(0,4));
			var month = parseInt(aStringDate.substring(5,7), 10) - 1;
			var day   = parseInt(aStringDate.substring(8), 10);
			var result = new Date(year, month, day);
			return result;
		} else {
			return null;
		}
	},
	
	/**
	 * convert javascript Date to SQLite string date (YYYY-MM-DD)
	 */
	convertDateToSQLite : function(aDate) {
	  if (aDate != null) {
	  	var year = aDate.getFullYear();
	  	var month = aDate.getMonth() + 1;  // since js month is 0-11
	  	if ( month < 10 )
		    month = "0" + month;
		  var date = aDate.getDate();
		  if ( date < 10 )
	    	date = "0" + date;
	  	var result = year + "-" + month + "-" + date; 
			return result;
	  } else { 
	  	return null;
		}
	}
};

window.addEventListener("load", function(e) {
			TASKMAIL.DB.onLoad(e);
		}, false);
