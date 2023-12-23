const taskmailCC = Components.classes;  
const taskmailCI = Components.interfaces;  
   
var tbirdsqlite = {
   
   getTaskListSQLite: function (mailId, folder, stateFilter, fillFunction) {
    var sql = ""; 
	var stat;
	var folderURI = folder.URI;
    try {
      // recherche par mail (donc non recurssive)
      if (mailId != null) {
        sql = "select tasks.rowid, title, state from tasks, links where tasks.folderURI = links.folderURI and tasks.rowid = links.taskId and links.folderURI = :folderURI and links.mailId = :mailId";
        // quelque soit le type de recherche (email ou folder) on applique le
		// filtre d'état
        if (stateFilter != "") {
          var stateExp = "";
          for (var i = 0; i < stateFilter.length; i++) {
            if (i > 0) {
              stateExp += ",";
            }
            stateExp += stateFilter.charAt(i);
          }
          sql += " and state in (" + stateExp + ")";
        }   
        stat = this.dbConnection.createStatement(sql);
        stat.bindStringParameter(0, folderURI);
        stat.bindStringParameter(1, mailId);
      // sinon recherche par folder
      } else {
        sql = "select tasks.rowid, title, state from tasks where folderURI = :folderURI";
        // quelque soit le type de recherche (email ou folder) on applique le
		// filtre d'état
        if (stateFilter != "") {
          var stateExp = "";
          for (var i = 0; i < stateFilter.length; i++) {
            if (i > 0) {
              stateExp += ",";
            }
            stateExp += stateFilter.charAt(i);
          }
          sql += " and state in (" + stateExp + ")";
        }   
        stat = this.dbConnection.createStatement(sql);
        stat.bindStringParameter(0, folderURI);
      }
      while (stat.executeStep()) {
         var id    = stat.getInt32(0);
         var title = stat.getString(1);
         var state = stat.getString(2);

          fillFunction (id, title, state, folderURI);
      }
    } catch (err) {
      alert(err);
    }
   },

   getTaskDetailSQLite: function (pk, fillFunction) {
    try {
      var stat = this.dbConnection.createStatement("select rowid, title, state, desc from tasks where rowid = :pk");
      stat.bindInt32Parameter(0, pk);
      while (stat.executeStep()) {
        var id    = stat.getInt32(0);
        var title = stat.getString(1);
        var state = stat.getString(2);
        var desc  = stat.getString(3);
        fillFunction (id, title, state, desc);
      }
    } catch (err) {
      alert(err);
    }
   },
  
   addTaskSQLite: function (idInput, titleInput, stateInput, desc, folder) {
    var folderURI = folder.URI;
    var stat = this.dbConnection.createStatement("insert into tasks (title, state, desc, folderURI) values (:titleInput, :stateInput, :desc, :folderURI)");
    stat.bindStringParameter(0,titleInput);
    stat.bindStringParameter(1,stateInput);
    stat.bindStringParameter(2,desc);
    stat.bindStringParameter(3,folderURI);
    stat.execute();
   },
  
   updateTaskSQLite: function (pk, title, state, desc) {
    var stat = this.dbConnection.createStatement("update tasks set title = :title, state = :state, desc = :desc where rowid = :pk");
    stat.bindStringParameter(0,title);
    stat.bindStringParameter(1,state);
    stat.bindStringParameter(2,desc);
    stat.bindInt32Parameter(3,pk);
    stat.execute();
   },
  
   removeTaskLinkSQLite: function (pk) {        
    var stat = this.dbConnection.createStatement("delete from tasks where rowid = :pk");
    stat.bindInt32Parameter(0,pk);
    stat.execute();
    var stat2 = this.dbConnection.createStatement("delete from links where taskId = :pk");
    stat2.bindInt32Parameter(0,pk);
    stat2.execute();
   },
   
   linkTaskSQLite: function (taskId, folder, mailId) {        
    var stat = this.dbConnection.createStatement("insert into links (folderURI, mailId, taskId) values (:folderURI, :mailId, :taskId)");
	var folderURI = folder.URI;
    stat.bindStringParameter(0,folderURI);
    stat.bindStringParameter(1,mailId);
    stat.bindInt32Parameter(2,taskId);
    stat.execute();
   },
   
   /**
    * détruit les lients
    * @param msgs un array de msg. doit être de même longeur que tasks
    * @param tasks un array de task. doit être de même longeur que tasks 
    * @return
    */
   unlinkTaskSQLite: function (msgs, taskId) {
	   var stat = this.dbConnection.createStatement("delete from links where folderURI = :URI and mailId = :MAIL_ID and taskId = :TASK_ID");
	   var folderURI = msgs.folder.URI;
	   var mailId = msgs.messageKey;
	   stat.bindStringParameter(0, folderURI);
	   stat.bindInt32Parameter(1, mailId);
	   stat.bindInt32Parameter(2, taskId);
	   stat.execute();
   },
   
   getLinkSQLite: function (folder) {
    // consoleService.logStringMessage("getLinkSQLite, folderName="+folderName);
    try {
      var sql = "select mailId, taskId from links, tasks where links.folderURI = tasks.folderURI and links.taskId = tasks.rowid and tasks.folderURI = :folderURI";
      var stat = this.dbConnection.createStatement(sql);
	  var folderURI = folder.URI;
      stat.bindStringParameter(0, folderURI);
      var i = 0;
       while (stat.executeStep()) {
         folderURILinks[nbLinks + i] = folderURI;
         mailKeysLinks[nbLinks + i] = stat.getInt32(0);
         taskIdLinks[nbLinks + i] = stat.getInt32(1);
         i++;
       }
       nbLinks = nbLinks + i;
    } catch (err) {
      Components.utils.reportError("getLinkSQLite " + err);
    }
   },

   renameFolderSQLite: function (aOrigFolder, aNewFolder) {
	// rename folder then rename subFolders
	try {
		this.dbConnection.beginTransaction();
		var origFolderName = aOrigFolder.name;
		// le origFolder n'a pas d'attribut parent
		var newFolderName  = aNewFolder.name;
		var newFolderURI   = aNewFolder.URI;
		
		var origSubFolderURI = aOrigFolder.URI;
		var newSubFolderURI  = aNewFolder.URI;

		var sql = "update tasks set folderURI = replace(folderURI, :old, :new) where folderURI like :like";
		var stat4 = this.dbConnection.createStatement(sql);
		stat4.bindStringParameter(0, origSubFolderURI);
		stat4.bindStringParameter(1, newSubFolderURI);
		stat4.bindStringParameter(2, origSubFolderURI + "%");
		stat4.execute();
		
		sql = "update links set folderURI = replace(folderURI, :old, :new) where folderURI like :like";
		var stat5 = this.dbConnection.createStatement(sql);
		stat5.bindStringParameter(0, origSubFolderURI);
		stat5.bindStringParameter(1, newSubFolderURI);
		stat5.bindStringParameter(2, origSubFolderURI + "%");
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
   deleteFolderSQLite: function (aFolder) {
	try {
		this.dbConnection.beginTransaction();
		
		var folderURI = aFolder.URI;
		consoleService.logStringMessage("deleteFolderSQLite"+folderURI);

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
	moveFolderSQLite: function (aSrcFolder, aDestFolder) {
		try {
			var oldParentURI = aSrcFolder.parent != null ? aSrcFolder.parent.URI : aSrcFolder.URI;
			var newParentURI = aDestFolder.URI;
			
			this.dbConnection.beginTransaction();
			
			var sql = "update tasks set folderURI = replace(folderURI, :OLD_URI,:NEW_URI) where folderURI like :OLD_LIKE_URI";
			var stat = this.dbConnection.createStatement(sql);
			stat.bindStringParameter(0, oldParentURI);
			stat.bindStringParameter(1, newParentURI);
			stat.bindStringParameter(2, aSrcFolder.URI + "%");
			stat.execute();
			
			sql = "update links set folderURI = replace(folderURI, :OLD_URI, :NEW_URI) where folderURI like :OLD_LIKE_URI";
			var stat2 = this.dbConnection.createStatement(sql);
			stat2.bindStringParameter(0, oldParentURI);
			stat2.bindStringParameter(1, newParentURI);
			stat2.bindStringParameter(2, aSrcFolder.URI + "%");
			stat2.execute();
		} catch (err) {
			this.dbConnection.rollbackTransaction();
			Components.utils.reportError("moveFolderSQLite" + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
	},
   
	/**
	 * @param aMsgs
	 *            An array of the message headers about to be deleted
	 */
	msgsDeletedSQLite: function(aMsgs) {
		try {
			this.dbConnection.beginTransaction();
			var TASK_SQL = "delete from tasks where rowid in (select taskId from links where folderURI = :URI and mailId = :ID)";
			var LINK_SQL = "delete from links where folderURI = :URI and mailId = :ID";
			var msgEnum = aMsgs.enumerate();
			while (msgEnum.hasMoreElements()) {
				var msg = msgEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
				var msgKey = msg.messageKey;
				var folderURI = msg.folder.URI;
				consoleService.logStringMessage("msgsDeletedSQLite"+folderURI+","+msgKey);
				var stat = this.dbConnection.createStatement(TASK_SQL);
				stat.bindStringParameter(0, folderURI);
				stat.bindStringParameter(1, msgKey);
				stat.execute();
				
				var stat2 = this.dbConnection.createStatement(LINK_SQL);
				stat2.bindStringParameter(0, folderURI);
				stat2.bindStringParameter(1, msgKey);
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
	 * @param aSrcMsgs
	 *            An array of the message headers in the source folder
	 * @param aDestFolder
	 *            The folder these messages were moved to.
	 * @param aDestMsgs
	 *            Present only for local folder moves, it provides the list of
	 *            target message headers.
	 */
	msgsMoveCopyCompletedSQLite: function(aSrcMsgs, aDestFolder, aDestMsgs){
		try {
			var TASK_SQL = "update tasks set folderURI = :NEW_URI where rowid in (select taskId from links where folderURI = :OLD_URI and mailId = :OLD_ID)";
			var LINK_SQL = "update links set folderURI = :NEW_URI, mailId = :NEW_MSG_KEY where folderURI = :OLD_URI and mailId = :OLD_MSG_KEY";
			
			var srcEnum = aSrcMsgs.enumerate();
			var destEnum = aDestMsgs.enumerate();
			
			while (srcEnum.hasMoreElements()) {
				var srcMsg = srcEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
				var destMsg = destEnum.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);

				consoleService.logStringMessage("msgsMoveCopyCompletedSQLite"+destMsg.folder.URI+","+
				                                srcMsg.folder.URI+","+srcMsg.messageKey);
				
				var stat = this.dbConnection.createStatement(TASK_SQL);
				stat.bindStringParameter(0, destMsg.folder.URI);
				stat.bindStringParameter(1, srcMsg.folder.URI);
				stat.bindStringParameter(2, srcMsg.messageKey);
				stat.execute();
				
				var stat2 = this.dbConnection.createStatement(LINK_SQL);
				stat2.bindStringParameter(0, destMsg.folder.URI);
				stat2.bindStringParameter(1, destMsg.messageKey);
				stat2.bindStringParameter(2, srcMsg.folder.URI);
				stat2.bindStringParameter(3, srcMsg.messageKey);
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
	 * @param aSrcFolder
	 *            A source folder from to move the task
	 * @param aTask
	 *            A task to move
	 * @param aDestFolder
	 *            A destination folder
	 * 
	 * @todo Pas encore de gestion du déplacement de tache avec des liens. Gérer
	 *       plusieurs taches
	 */
	taskMoveSQLite: function(aTaskID, aDestFolder) {
		var SQL = "update tasks set folderURI = :NEW_URI where rowid = :TASK_ID";
		var stat = this.dbConnection.createStatement(SQL);
		stat.bindStringParameter(0, aDestFolder.URI);
		stat.bindStringParameter(1, aTaskID);
		stat.execute();
		consoleService.logStringMessage("taskMoveSQLite " + aTaskID + " dans " + aDestFolder.URI);
	},
   
   onLoad: function() {  
     // initialization code
     this.initialized = true;  
     this.dbInit();
     this.dbUpgrade();
   },  
   
   dbConnection: null,  
   
   /* la pk de la table est le rowid interne de sqlite */
   dbSchema: {  
      tables: {  
        tasks:"folderURI TEXT, title TEXT NOT NULL, state TEXT, desc TEXT",
        links:"folderURI TEXT, mailId TEXT, taskId NUMBER",
        model_version:"version NUMERIC"
     }  
   },  
   
   dbInit: function() {  
     var dirService = taskmailCC["@mozilla.org/file/directory_service;1"].  
       getService(taskmailCI.nsIProperties);  
   
     var dbFile = dirService.get("ProfD", taskmailCI.nsIFile);  
     dbFile.append("tasks.sqlite");  
   
     var dbService = taskmailCC["@mozilla.org/storage/service;1"].  
       getService(taskmailCI.mozIStorageService);  
   
     var dbConnection;  
   
     if (!dbFile.exists()) {
       dbConnection = this._dbCreate(dbService, dbFile);  
       this._dbInitTables(dbConnection);
     } else {  
       dbConnection = dbService.openDatabase(dbFile);  
     }  
     this.dbConnection = dbConnection;  
   },
   
	dbUpgrade: function () {
		try {
			this.dbConnection.beginTransaction();
			var currentVersion = 0;
			var targetVersion = 4;
			var stat = this.dbConnection.createStatement("select version from model_version");
			try {
				stat.executeStep();
				currentVersion = stat.getInt32(0);
			} catch (err) {
				stat = this.dbConnection.createStatement("CREATE TABLE model_version (version NUMERIC)");
				stat.execute();
				stat = this.dbConnection.createStatement("insert into model_version values (2)");
				stat.execute();
			}			
			if (currentVersion < targetVersion) {
				alert("Upgrade of db model needed. Please save our sqllite file in 'user profile directory'/tasks.sqlite then press OK.");
			}
			if (currentVersion < 4) {
				this.dbUpgrade4();			
			}
			if (currentVersion < targetVersion) {
				stat = this.dbConnection.createStatement("update model_version set version = 4");
				stat.execute();
				alert("Upgrade successful.");
			}
		} catch (err) {
			this.dbConnection.rollbackTransaction();
				alert("Upgrade problem : " + err);
		} finally {
			this.dbConnection.commitTransaction();
		}
   },
   
	dbUpgrade4: function () {
		var stat = this.dbConnection.createStatement("update tasks set folderURI = replace(folderURI,'mailbox-message:','mailbox:')");
		stat.execute();
		stat = this.dbConnection.createStatement("update links set folderURI = replace(folderURI,'mailbox-message:','mailbox:')");
		stat.execute();
   },

   _dbCreate: function(aDBService, aDBFile) {  
     var dbConnection = aDBService.openDatabase(aDBFile);  
     this._dbCreateTables(dbConnection);  
     return dbConnection;  
  },  
   
  _dbCreateTables: function(aDBConnection) {  
    for(var name in this.dbSchema.tables)  
       aDBConnection.createTable(name, this.dbSchema.tables[name]);  
  },
  
  _dbInitTables: function (connexion) {
	var stat = connexion.createStatement("insert into model_version values (3)");
	stat.execute();
	consoleService.logStringMessage("Database initialisation successful.");
  }
};
window.addEventListener("load", function(e) { tbirdsqlite.onLoad(e); }, false); 
