"use babel";

import NarrowNoteDialog from "./narrow-note-dialog";

module.exports = {
  config: {
    migemoDictPath: {
      title: "migemo dictionary file path",
      type: "string",
      default: "",
    },
    defaultDisplayNumber: {
      title: "default display number",
      type: "integer",
      default: 10,
    },
    limit: {
      title: "The limit on the number of notes to be searched",
      type: "integer",
      default: 2000,
    },
  },
  activate() {
    inkdrop.components.registerClass(NarrowNoteDialog);
    inkdrop.layouts.addComponentToLayout("modal", "NarrowNoteDialog");
  },

  deactivate() {
    inkdrop.layouts.removeComponentFromLayout("modal", "NarrowNoteDialog");
    inkdrop.components.deleteClass(NarrowNoteDialog);
  },
};
