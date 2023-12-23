pref("extensions.taskmail.report.to", "to@domain.fr");
pref("extensions.taskmail.report.cc", "cc@domain.fr");
pref("extensions.taskmail.report.subject", "subject");
pref("extensions.taskmail.report.body", "Report\n<ul>\n#FOLDER#\n    <li>#FOLDER_NAME#</li>\n    <ul>\n       #TASK#<li>#TASK_TITLE# (<tt>#TASK_PRIO#</tt>)\n   <b>#TASK_STATE#</b>\n   #TASK_CREATION_DATE# <u>#TASK_DUE_DATE#</u> #TASK_COMPLETION_DATE#\n    <i>#TASK_DESC#</i>\n   </li>#TASK#\n       #SUB_FOLDERS#\n    </ul>\n#FOLDER#\n</ul>\nBest regards");
pref("extensions.taskmail.states", "chrome://taskmail/locale/taskmail-overlay.properties");
pref("extensions.taskmail.showMessageOnMouseClick", "MIDDLE");
pref("extensions.taskmail.transientScope", true);