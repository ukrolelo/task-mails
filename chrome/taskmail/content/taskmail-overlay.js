var stateLabels = ["info", "à faire", "à suivre", "attente", "fait"];
var stringsBundle = null;

// //////////////////////////////////////////////////////////////////////////////
// gestion des liens
//

/**
 * lie email et tâches courants. En fonction du send du lien,
 * un seul objet sélectionnable
 * @param sens String "task" or "mail"
 */
function linkTask(sens) {
    var folder = GetSelectedMsgFolders()[0];
    if (!allEqualsSelectedTasksFolderURI(folder.URI)) {
    	// un des taches dans un sous folder.
    	alert(stringsBundle.getString("LinkAlertSubfolder"));
    	return;
    }
    if (sens == "mail") {
	    var selectedMessages = gFolderDisplay.selectedMessages;
	    // TODO améliorer le test en autorisant, quelques soit le sens, des liens 1-N.
	    if (selectedMessages.length > 1) {
	    	// trop de mails sélectionnés
	    	alert(stringsBundle.getString("LinkAlertTooManyMail"));
	    	return;
	    }
	    var taskIds = getSelectedTasksKeys();
	    for (var i = 0; i < taskIds.length; i++) {
	    	var taskId = taskIds[i];
	    	tbirdsqlite.linkTaskSQLite(taskId, folder, selectedMessages[0].messageKey);	
	    }
    } else {
	    var taskIds = getSelectedTasksKeys();
	    if (taskIds.length > 1) {
	    	// trop de taches sélectionnées
	    	alert(stringsBundle.getString("LinkAlertTooManyTask"));
	    	return;
	    }
	    var selectedMessages = gFolderDisplay.selectedMessages;
	    for (var i = 0; i < selectedMessages.length; i++) {
	    	tbirdsqlite.linkTaskSQLite(taskIds[0], folder, selectedMessages[i].messageKey);
	    }	
    }
    // var mailKey = gDBView.getKeyAt(mailIndices[0]);
    // consoleService.logStringMessage(link done
    // tache="+taskId+",mail="+mailId);

    refreshTaskList();
    refreshMailLink();
}

/**
 * détruit tous les liens entre les emails sélectionnés et les taches
 * sélectionnées.
 * 
 * @return void
 */
function unlinkTask() {
    if (window.confirm(stringsBundle.getString('confirmDeleteLink'))) {
        // parcours tous les messages sélectionnés pour trouver les taches liées
        // dans celles sélectionnés
        // TODO optimisation possible en n'invocant uniquement pour les liens liées;
        var selectedMessages = gFolderDisplay.selectedMessages; // OK un objet msg
        var listBox = document.getElementById("taskList");
        var selectedTasks = listBox.selectedItems;
        for (var i = 0; i < selectedMessages.length; i++) {
            for (var j = 0; j < selectedTasks.length; j++) {
                tbirdsqlite.unlinkTaskSQLite(selectedMessages[i], selectedTasks[j]
                                .getAttribute("pk"));
            }
        }
        refreshTaskList();
        refreshMailLink();
    }
}

function showLinkedTask() {
    try {
        // récupére la key du 1° email selectionné
        var mailKey = gDBView.keyForFirstSelectedMessage;
        // recupére les ID de taches liées au mail
        var TaskIDs = getTaskIDFromMailID(mailKey);
        // recupére les index des taches associées
        var taskIndex = getTaskIndexFromTaskID(TaskIDs);
        // identifie l'index de la tache suivante
        if (taskIndex.length > 0) {
            var founded = false;
            for (var i = 0; i < taskIndex.length; i++) {
                if (document.getElementById("taskList").selectedIndex == taskIndex[i]) {
                    founded = true;
                    break;
                }
            }
            if (founded) {
                if (i == taskIndex.length - 1) {
                    i = -1;
                }
            } else {
                i = -1;
            }
            document.getElementById("taskList").selectedIndex = taskIndex[i + 1];
        }
    } catch (err) {
    }
}

/**
 * selection le prochain email liée.
 * basé sur la tache qui a reçue le click droit.
 */
function showLinkedMail() {
    var taskID = document.popupNode.getAttribute("pk");
    var folderURI = document.popupNode.getAttribute("folderURI");
    // recupére les keys de mail liés à la tache
    var keysMails = getMailKeysFromTaskID(taskID);
    if (keysMails != null && keysMails.length > 0) {
        // si la tache selectionnée a au moins un mail lié
        var i = -1;
        try {
            var selectedMailKey = gDBView.keyForFirstSelectedMessage;
            var founded = false;
            // identifie le mail suivant
            for (var i = 0; i < keysMails.length; i++) {
                // on prend le 1° mail sélectionné
                if (selectedMailKey == keysMails[i]) {
                    founded = true;
                    break;
                }
            }
            if (founded) {
                if (i == keysMails.length - 1) {
                    i = -1;
                }
            } else {
                i = -1;
            }
        } catch (err) {
        }
        // keysMail pourrait être modifié par le changement de folder
        var keyMailToSelect = keysMails[i + 1];
        // if task from subfolder select folder.
        if (GetSelectedMsgFolders()[0].URI != folderURI) {
	        SelectFolder(folderURI);
        }
        gDBView.selectMsgByKey(keyMailToSelect);
    }
}

/**
 * Sélectionne les emails liés aux tâches sélectionnées.
 * Toutes les taches doivent être dans le folder courant.
 */
function selectLinkedMails() {
	var folder = GetSelectedMsgFolders()[0];
	if (!allEqualsSelectedTasksFolderURI(folder.URI)) {
    	// un des taches dans un sous folder.
    	alert(stringsBundle.getString("SelectMailLinkAlertSubfolder"));
    	return;
    }
	var tasks = getSelectedTasksKeys();
	var allMails = new Array();
	for (var i = 0; i < tasks.length; i++) {
		var mails = getMailKeysFromTaskID(tasks[i]);
		if (mails != null) allMails = allMails.concat(mails);
	}
	if (allMails.length > 0) {
		gDBView.selection.clearSelection();
		for (var i = 0; i < allMails.length; i++) {
			var j = gDBView.findIndexFromKey(allMails[i], false);
			gDBView.selection.rangedSelect(j, j, true);
		}
	}
}

function goFolder() {
    var folderURI = document.popupNode.getAttribute("folderURI");
    if (GetSelectedMsgFolders()[0].URI != folderURI) {
        SelectFolder(folderURI);
    }
}

var folderURILinks = new Array();
var mailKeysLinks = new Array();
var taskIdLinks = new Array();
var nbLinks = 0;

// use to populate custom column
function hasMail(taskID) {
    // consoleService.logStringMessage("hasMail, taskID=" + taskID + ", nbLinks=" + nbLinks);
    var result = false;
    for (var i = 0; i < nbLinks; i++) {
        if (taskIdLinks[i] == taskID) {
            result = true;
            break;
        }
    }
    return result;
}

function hasTask(messageKey) {
    // consoleService.logStringMessage("hasTask, mailID=" + messageID + ",nbLinks=" + nbLinks);
    var result = false;
    for (var i = 0; i < nbLinks; i++) {
        if (mailKeysLinks[i] == messageKey) {
            result = true;
            break;
        }
    }
    return result;
}

/**
 * détermine les clés de taches à partir de la clé de mail spécifiée
 * @param String mailKey
 * @return Array
 */
function getTaskIDFromMailID(mailKey) {
    var result = new Array();
    var j = 0;
    for (var i = 0; i < nbLinks; i++) {
        if (mailKeysLinks[i] == mailKey) {
            result[j++] = taskIdLinks[i];
        }
    }
    // consoleService.logStringMessage(result);
    return result;
}

/**
 * Détermine les clé de mail correspondant à la tache spécifiée.
 */
function getMailKeysFromTaskID(taskID) {
    var result = null;
    var nbResult = 0;
    for (var i = 0; i < nbLinks; i++) {
        if (taskIdLinks[i] == taskID) {
            if (result == null) {
                result = new Array();
            }
            result[nbResult] = mailKeysLinks[i];
            nbResult += 1;
        }
    }
    // consoleService.logStringMessage(result);
    return result;
}

// recupére les index des taches dont les pk sont fournies
// taskID : tableau de taskID
// result : tableau d'index
function getTaskIndexFromTaskID(taskID) {
    var result = new Array();
    var nbResult = 0;
    var listBox = document.getElementById("taskList");
    for (var j = 0; j < taskID.length; j++) {
        var i = 0;
        while (i < listBox.getRowCount()) {
            var row = listBox.getItemAtIndex(i);
            if (row.getAttribute("pk") == taskID[j]) {
                result[nbResult] = i;
                nbResult += 1;
            }
            i++;
        }
    }
    // consoleService.logStringMessage(result);
    return result;
}

function getMailIndexFromMailKey(mailKeys) {
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
    // consoleService.logStringMessage(result);
    return result;
}

/**
 * 
 * @param {} taskID
 * @param {} selectedMailKey
 * @return 2 = lien surligné, 1 = lien, 0 = pas de lien
 */
function getTaskLinkType(taskID, selectedMailKey) {
    // taskID à -1 si pas de tache sélectionnée
    var direct = false;
    var undirect = false;
    for (var j = 0; j < nbLinks; j++) {
        if (taskID == taskIdLinks[j]) {
            if (selectedMailKey == mailKeysLinks[j]) {
                direct = true;
            } else {
                undirect = true;
            }
        }
    }
    var result = direct ? 2 : undirect ? 1 : 0;
    return result;
}

/**
 * 
 * @param {} taskID
 * @param {} selectedMailKey
 * @return 2 = lien surligné, 1 = lien, 0 = pas de lien
 */
function getMailLinkType(taskID, selectedMailKey) {
    // taskID à -1 si pas de tache sélectionnée
    var direct = false;
    var undirect = false;
    for (var j = 0; j < nbLinks; j++) {
        if (selectedMailKey == mailKeysLinks[j]) {
            if (taskID == taskIdLinks[j]) {
                direct = true;
            } else {
                undirect = true;
            }
        }
    }
    var result = direct ? 2 : undirect ? 1 : 0;
    return result;
}

function refreshTaskLink() {
    var selectedMailKey = null;
    try {
        selectedMailKey = gDBView.keyForFirstSelectedMessage;
    } catch (err) {
    }
    // parcours tout les taches et regarde s'il existe une tache liée
    var listBox = document.getElementById("taskList");
    for (var i = 0; i < listBox.getRowCount(); i++) {
        var row = listBox.getItemAtIndex(i);
        var linkType = getTaskLinkType(row.getAttribute("pk"), selectedMailKey);
        //row.lastChild.setAttribute("label", text);
        var linkURL = null;
        if (linkType == 2) {
            linkURL = "chrome://taskmail/skin/link_mail_hilight.jpg";
        } else if (linkType == 1) {
            linkURL = "chrome://taskmail/skin/link_mail.jpg";
        }
        row.lastChild.setAttribute("image", linkURL);
    }
}

function refreshMailLink() {
    var tree = document.getElementById("threadTree");
    // parcours tout les taches et regarde s'il existe une tache liée
    var column = tree.columns.getNamedColumn("colTask");
    tree.treeBoxObject.invalidateColumn(column);
}

/**
 * @param sens String "task" or "mail"
 */
function adjustContextMenu(sens) {
	var menuitem = null;
	var linkedObject = null;
	if (sens == "task") {
		menuitem = document.getElementById('row-menu.goNextMail');
		linkedObject = getMailKeysFromTaskID(document.popupNode.getAttribute("pk"));
	} else {
		menuitem = document.getElementById('mailContext.goNextTask');
		// TODO obtenir email ayant reçu click droit.
		var mails = gFolderDisplay.selectedMessages;
		linkedObject = getTaskIDFromMailID(mails[0].messageKey); 
	}
	var regExp = new RegExp("[0-9]+");
	var count = linkedObject != null ? linkedObject.length : 0;
	menuitem.label = menuitem.label.replace(regExp,count);
	
	if (sens == "task") {
		// on désactive 'go to folder' si la tache courante est dans le folder courant.
		var currentFolder = GetSelectedMsgFolders()[0];
		var taskFolderURI = document.popupNode.getAttribute("folderURI");
		menuitem = document.getElementById('row-menu.goFolder');
		menuitem.disabled = currentFolder.URI == taskFolderURI;
	}
}

// //////////////////////////////////////////////////////////////////////////////
// gestion de la liste
//

function getTaskList() {
    var currentMsgFolder = GetSelectedMsgFolders()[0];
    var viewFilter = document.getElementById("viewFilter").selectedItem.value;
    nbLinks = 0;
    if (viewFilter == 2) {
        // recherche par mail
        try {
            var selectedMailKey = gDBView.keyForFirstSelectedMessage;
            // consoleService.logStringMessage(selectedMailKey);
            var stateFilter = document.getElementById("stateFilter").selectedItem.value;
            // il faut charger les liens avant les taches
            tbirdsqlite.getLinkSQLite(currentMsgFolder);
            tbirdsqlite.getTaskListSQLite(selectedMailKey, currentMsgFolder,
                    stateFilter, fillTaskList);
        } catch (err) {
        }
    } else {
        var recur = viewFilter == 1;
        // évite erreur sur "dossier locaux"
        if (currentMsgFolder != null) {
            getTaskListRec(currentMsgFolder, recur);
        }
    }
    // refresh link
    refreshTaskLink();
    refreshMailLink();
}

function getTaskListRec(folder, recur) {
    var stateFilter = document.getElementById("stateFilter").selectedItem.value;
    // il faut charger les liens avant les taches ; chargement récurssif
    tbirdsqlite.getLinkSQLite(folder);
    tbirdsqlite.getTaskListSQLite(null, folder, stateFilter, fillTaskList);

    // récupére les sous folders si possible et si demandé
    if (folder.hasSubFolders && recur) {
        var subFolders = folder.subFolders;
        try {
            while (subFolders.hasMoreElements()) {
                var subFolder = subFolders.getNext();
                getTaskListRec(subFolder, recur);
            }
        } catch (e) {
        }
    }
}

function emptyList() {
    var listBox = document.getElementById("taskList");
    while (listBox.getRowCount() > 0) {
        listBox.removeItemAt(0);
    }
}

function refreshTaskList() {
    // consoleService.logStringMessage("refreshTaskList");
    // le refresh du folder est lancé avant l'handler de la colonne des emails.
	var selectedTasks = getSelectedTasksKeys();
    emptyList();
    getTaskList();
    selectedTasksByKeys(selectedTasks);
}

/**
 * return tasks selected keys. 
 * @return Array[int]
 */
function getSelectedTasksKeys() {
	var listBox = document.getElementById("taskList");
    var selectedTasks = listBox.selectedItems;
    var result = new Array();
    for (var i = 0; i < selectedTasks.length; i++) {
		result.push(selectedTasks[i].getAttribute("pk"));
    }
    return result;
}

function allEqualsSelectedTasksFolderURI(folderURI) {
	var listBox = document.getElementById("taskList");
    var selectedTasks = listBox.selectedItems;
    for (var i = 0; i < selectedTasks.length; i++) {
    	if (selectedTasks[i].getAttribute("folderURI") != folderURI) {
    		return false;
    	}
    }
    return true;
}

/**
 * select tasks by keys
 * @param Array[int] keys
 * @return void
 */
function selectedTasksByKeys (keys) {
	var listBox = document.getElementById("taskList");
	for (var i = 0; i < listBox.getRowCount(); i++) {
		var row = listBox.getItemAtIndex(i);
		if (keys.indexOf(row.getAttribute("pk")) > -1) {
			listBox.addItemToSelection(row);
		}
	}
}

function stateFilterChange() {
    refreshTaskList();
}

function viewFilterChange() {
    var viewFilter = document.getElementById("viewFilter").selectedItem.value;
    if (viewFilter == 2) {
        // recherche par mail
        // il faut supprimer le refreshTaskLink et le remettre pour qui soit en
        // 2°
        document.getElementById("threadTree").removeEventListener("select",
                refreshTaskLink, false);
        document.getElementById("threadTree").addEventListener("select",
                refreshTaskList, false);
        document.getElementById("threadTree").addEventListener("select",
                refreshTaskLink, false);
    } else {
        document.getElementById("threadTree").removeEventListener("select",
                refreshTaskList, false);
    }
    refreshTaskList();
}

// //////////////////////////////////////////////////////////////////////////////
// gestion des mises à jour
//

// -1 = new task
var taskDetailPK = -1;
var addWithLink = false;

function doubleClikTask(event) {
    var box = document.getElementById("addTask");
    var pk = event.target.getAttribute("pk");
    if (box.collapsed || taskDetailPK != pk) {
    	// si on double clique sur une autre tache, ça l'ouvre
        beginUpdateTask();
    } else {
        cancelSaveTask();
    }
}

/**
 * provoque la sauvegarde de la tache ou son annulation
 * uniquement si le focus est dans le datail de la tache
 * @param {} action
 */function taskDetailKey(action) {
	var focused = document.commandDispatcher.focusedElement;
	while (focused.id == "addTask" || focused.parentNode != null) {
		if (focused.id == "addTask") {
			if (action == "save") {
				saveTask();
			} else {
				cancelSaveTask();
			}
			break;
		}
		focused = focused.parentNode;
	}
}

function beginAddTaskWithLink() {
    beginAddTask();
    // addWithLink après pour overrider
    addWithLink = true;
}

function beginAddTask() {
    // clean UI
    fillTaskDetail("", "", 1, "");
    var box = document.getElementById("addTask");
    box.collapsed = false;
    document.getElementById("taskTitle").focus();
    taskDetailPK = -1;
    addWithLink = false;
}

/*
 * Update la tache (la 1° sélectionnée)
 * 
 */
function beginUpdateTask() {
    // get task detail
    var listBox = document.getElementById("taskList");
    var taskKeys = getSelectedTasksKeys();
    if (taskKeys.length > 0) {
    	// on prend la 1° tache sélectionnée
	    tbirdsqlite.getTaskDetailSQLite(taskKeys[0], fillTaskDetail);
	    // show details
	    var box = document.getElementById("addTask");
	    box.collapsed = false;
	    document.getElementById("taskTitle").focus();
	    taskDetailPK = taskKeys[0];
    }
}

function saveTask() {
    var idInput = document.getElementById("addTask").value;
    var titleInput = document.getElementById("taskTitle").value;
    var stateInput = document.getElementById("taskState").selectedItem.value;
    var desc = document.getElementById("taskDesc").value;
    var currentMsgFolder = GetSelectedMsgFolders()[0];

    if (taskDetailPK == -1) {
        tbirdsqlite.addTaskSQLite(idInput, titleInput, stateInput, desc,
                currentMsgFolder);
        if (addWithLink) {
            var taskId = tbirdsqlite.dbConnection.lastInsertRowID;
            var selectedMessages = gFolderDisplay.selectedMessages;
            for (var i = 0; i < selectedMessages.length; i++) {
                var mailKey = selectedMessages[i].messageKey;
                tbirdsqlite.linkTaskSQLite(taskId, currentMsgFolder, mailKey);
            }
        }
    } else {
        tbirdsqlite.updateTaskSQLite(idInput, titleInput, stateInput, desc);
    }
    refreshTaskList();
    cancelSaveTask();
}

function cancelSaveTask() {
    var box = document.getElementById("addTask");
    box.collapsed = true;
}

/**
 * efface toutes les tâches sélectionnées avec les liens associés
 */
function removeTask() {
    // demande une confirmation
    if (window.confirm(stringsBundle.getString('taskDeleteConfirm'))) {
        var listBox = document.getElementById("taskList");
        var taskIds = getSelectedTasksKeys();
        for (var i = 0; i < taskIds.length; i++) {
        	tbirdsqlite.removeTaskLinkSQLite(taskIds[i]);
        	// ferme le détail de tâche si ouverte
        	if (taskDetailPK == taskIds[i]) cancelSaveTask();
        }
        refreshTaskList();
        refreshMailLink();
    }
}

/**
 * déplace les taches dans un nouveau folder si les taches n'ont pas de liens.
 */
function moveTask(aDestFolder) {
    var tasks = getSelectedTasksKeys();
    for (var i = 0; i < tasks.length; i++) {
	    // si la tache a un lien, on ne fait rien.
	    if (getMailKeysFromTaskID(tasks[i]) != null) {
	        alert(stringsBundle.getString("moveLinkAlert"));
	        return;
	    }
    }
    for (var i = 0; i < tasks.length; i++) {
	    tbirdsqlite.taskMoveSQLite(tasks[i], aDestFolder);
    }
    if (tasks.length > 0) {
    	refreshTaskList();
    }
}

/**
 * si l'email est liée à au moins une tache liée à un autre mail, one ne fait
 * rien.
 * 
 * @param selectedMsgs
 */
function msgsMoveable(selectedMsgs) {

    // 1 transforme enum en Array de selected msg key
    var selectedMsgKey = new Array();
    var srcEnum = selectedMsgs.enumerate();
    while (srcEnum.hasMoreElements()) {
        var srcMsg = srcEnum.getNext()
                .QueryInterface(Components.interfaces.nsIMsgDBHdr);
        selectedMsgKey.push(srcMsg.messageKey);
    }
    // 2 pour chaque selected msg, recupére les taches liées
    // dès qu'un msg lié hors sélection, on stoppe
    var stop = false;
    for (var i = 0; i < selectedMsgKey.length && !stop; i++) {
        var taskIDs = getTaskIDFromMailID(selectedMsgKey[i]);
        for (var j = 0; j < taskIDs.length && !stop; j++) {
            var msgKeys = getMailKeysFromTaskID(taskIDs[j]);
            for (var k = 0; k < msgKeys.length && !stop; k++) {
                if (selectedMsgKey.indexOf(msgKeys[k]) == -1) {
                    stop = true;
                }
            }
        }
    }
    return !stop;
}

function init() {
    document.getElementById("folderTree").addEventListener("select",
            refreshTaskList, false);
    document.getElementById("threadTree").addEventListener("select",
            refreshTaskLink, false);
    document.getElementById("taskList").addEventListener("select",
            refreshMailLink, false);
    // bug, pas possible d'utiliser onpopupshowing dans le .xul
    document.getElementById("mailContext").addEventListener("popupshowing",
            adjustContextMenu, false);

    var newMailListener = {
        folderRenamed : function(aOrigFolder, aNewFolder) {
            tbirdsqlite.renameFolderSQLite(aOrigFolder, aNewFolder);
            refreshTaskLink();
            refreshMailLink();
        },
        folderDeleted : function(aFolder) {
            // Rien lors de la suppression réelle puisque ça passe par la
            // corbeille
            // Une fois dans la corbeille, 1 supprimer => un event
            // folderDeleted,
            // un vidage de corbeille => un event de plus pour 'corbeille'
            // Un event par subFolder en partant du dessous.
            // le baseMessageURI est conforme
            // avant delete mailbox-message://nobody@Local%20Folders/toto/titi
            // l'uri est modifié
            // consoleService.logStringMessage(aFolder.baseMessageURI);
            tbirdsqlite.deleteFolderSQLite(aFolder);
        },
        folderMoveCopyCompleted : function(aMove, aSrcFolder, aDestFolder) {
            if (aMove) {
                tbirdsqlite.moveFolderSQLite(aSrcFolder, aDestFolder);
            }
        },
        msgsMoveCopyCompleted : function(aMove, aSrcMsgs, aDestFolder,
                aDestMsgs) {
            if (aMove) {
                var moveable = msgsMoveable(aSrcMsgs);
                // si problème on alerte mais le déplacement de message est déjà
                // fait donc on laisse faire.
                // @todo voir comment empecher le déplacement
                if (!moveable) {
                    alert(stringsBundle.getString("moveMailAlert"));
                }
                tbirdsqlite.msgsMoveCopyCompletedSQLite(aSrcMsgs, aDestFolder,
                        aDestMsgs);
                refreshTaskList();
            }
        },
        msgsDeleted : function(aMsgs) {
            tbirdsqlite.msgsDeletedSQLite(aMsgs);
        }
    }

    var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
            .getService(Components.interfaces.nsIMsgFolderNotificationService);
    notificationService.addListener(newMailListener,
            notificationService.folderRenamed
                    | notificationService.folderDeleted
                    | notificationService.folderMoveCopyCompleted
                    | notificationService.msgsMoveCopyCompleted
                    | notificationService.msgsDeleted);

    stringsBundle = document.getElementById("string-bundle");
}

// besoin de passer par le load de la fenêtre sinon ça plante thunderbird
// (peut-être UI pas prête)
window.addEventListener("load", init, false);

// Pour logguer
var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);

function fillTaskDetail(id, title, state, desc) {
    document.getElementById("addTask").value = id;
    document.getElementById("taskTitle").value = title;
    document.getElementById("taskDesc").value = desc;
    var stateList = document.getElementById("taskState");
    var ligne = stateList.firstChild;
    for (var i = 0; i < ligne.childNodes.length; i++) {
        if (ligne.childNodes[i].value == state) {
            stateList.selectedIndex = state;
            break;
        }
    }
}

function fillTaskList(id, title, state, folderURI) {
    var row = _makeRowList(id, title, state, folderURI);
    document.getElementById("taskList").appendChild(row);
}

function _makeRowList(pk, titleInput, stateInput, folderURI) {
    var row = document.createElement('listitem');
    
    row.setAttribute('pk', pk);
    row.setAttribute("folderURI", folderURI);
    
    // Create and attach 1st cell
    var cell = document.createElement('listcell');
    cell.setAttribute('label', stateLabels[stateInput]);
    // cell.setAttribute('value', value );
    row.appendChild(cell);
    // Create and attach 2nd cell
    cell = document.createElement('listcell');
    cell.setAttribute('label', titleInput);
    // cell.setAttribute('value', value2 );
    row.appendChild(cell);

    // le text du lien sera setté plus tard
    var linkText = "";

    cell = document.createElement('listcell');
    cell.setAttribute('label', null);
    cell.setAttribute('class','listcell-iconic icon-mail-column');
    //cell.setAttribute('image','chrome://taskmail/skin/link_mail.jpg');
    row.appendChild(cell);

    return row;
}

function _unique(array) {
    var r = new Array();
    o : for (var i = 0, n = array.length; i < n; i++) {
        for (var x = 0, y = r.length; x < y; x++) {
            if (r[x] == array[i]) {
                continue o;
            }
        }
        r[r.length] = array[i];
    }
    return r;
}

// /////////////////////////////////////////////////////////////////////////////
// Tests

function displayFolderURI() {
    /*
     * var messageArray={}; messageArray=GetSelectedMessages(); var messageURI =
     * messageArray[0]; var header = messenger.msgHdrFromURI(messageURI); var
     * messageID = header.messageId;
     */
    // avant modif
    // messgeURI=mailbox-message://nobody@Local%20Folders/Inbox#3587310
    // messageID=50826FCACE4318438E8AF53FD716466701E595A36F@exdruembetl003.eq1etl.local
    // Components.utils.reportError("messgeURI="+messageURI+"\n"+"messageID
    // ="+messageID);
    // après déplacement de l'email
    // messgeURI=mailbox-message://nobody@Local%20Folders/Trash#143700885
    // messageID=50826FCACE4318438E8AF53FD716466701E595A36F@exdruembetl003.eq1etl.local
    // conclusion : même messgeID. l'uri elle est différente.
    var folder = GetSelectedMsgFolders()[0];
    consoleService.logStringMessage("URI"+folder.URI);
    consoleService.logStringMessage("baseMessageURI"+folder.baseMessageURI);
}

function displaySelectedTask () {
    var listbox = document.getElementById("taskList");
    var selectedItems = listbox.selectedItems;
    for (var i = 0; i < selectedItems.length; i++) {
        
    }
    var selectedIndex = listbox.selectedItems.map(function (item) {return listbox.getIndexOfItem(item)});
    consoleService.logStringMessage(selectedIndex);
}

function reprise(folder) {
    if (folder == null) {
        folder = GetSelectedMsgFolders()[0];
    }
    tbirdsqlite.reprise(folder);
    if (folder.hasSubFolders) {
        var subFolders = folder.subFolders;
        try {
            while (subFolders.hasMoreElements()) {
                var subFolder = subFolders.getNext();
                tbirdsqlite.reprise(subFolder);
            }
        } catch (e) {
            consoleService.logStringMessage(e);
        }
    }
    consoleService.logStringMessage(folder.URI);
}

/*
 * URI =
 * mailbox-message://nobody@Local%20Folders/_maintenance/Autom%20Tests var
 * mailKey = GetSelectedMessages(); // provoque un plantage
 */

function testSelectFolder() {
//	SelectFolder("mailbox-message://nobody@Local%20Folders/_maintenance/dpca");
	SelectFolder("mailbox://nobody@Local%20Folders/_maintenance/dpca");
}