"use babel";

import SwitchNoteMessageDialog from "./switch-note-message-dialog";

module.exports = {
  config: {
    migemoDictPath: {
      title: "migemo ditionary file path",
      type: "string",
      default: "",
    },
  },
  activate() {
    inkdrop.components.registerClass(SwitchNoteMessageDialog);
    inkdrop.layouts.addComponentToLayout("modal", "SwitchNoteMessageDialog");
  },

  deactivate() {
    inkdrop.layouts.removeComponentFromLayout("modal", "SwitchNoteMessageDialog");
    inkdrop.components.deleteClass(SwitchNoteMessageDialog);
  },
};
