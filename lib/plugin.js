"use babel";

import NarrowNoteDialog from "./narrow-note-dialog";

module.exports = {
  config: {
    migemoDictPath: {
      title: "migemo ditionary file path",
      type: "string",
      default: "",
    },
  },
  activate() {
    inkdrop.components.registerClass(NarrowNoteDialog);
    inkdrop.layouts.addComponentToLayout("modal", "NarrowNoteDialog");
  },

  deactivate() {
    inkdrop.layouts.removeComponentFromLayout("modal", "NarrowNoteDialog");
    inkdrop.components.deleteClass(SwitchNoteMessageDialog);
  },
};
