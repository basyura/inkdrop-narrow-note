import { createInkdropMock } from "./helpers/create-inkdrop-mock";

jest.mock(
  "inkdrop",
  () => {
    const ReactModule = require("react");
    return {
      useModal() {
        const [visible, setVisible] = ReactModule.useState(false);
        return {
          state: { visible },
          show: () => setVisible(true),
          close: () => setVisible(false),
        };
      },
    };
  },
  { virtual: true }
);

import plugin from "../lib/plugin";
import NarrowNoteDialog from "../lib/narrow-note-dialog";

describe("plugin", () => {
  it("activate でモーダルを登録する", () => {
    const { inkdrop } = createInkdropMock();

    plugin.activate();

    expect(inkdrop.components.registerClass).toHaveBeenCalledWith(
      NarrowNoteDialog
    );
    expect(inkdrop.layouts.addComponentToLayout).toHaveBeenCalledWith(
      "modal",
      "NarrowNoteDialog"
    );
  });

  it("deactivate でモーダル登録を解除する", () => {
    const { inkdrop } = createInkdropMock();

    plugin.deactivate();

    expect(inkdrop.layouts.removeComponentFromLayout).toHaveBeenCalledWith(
      "modal",
      "NarrowNoteDialog"
    );
    expect(inkdrop.components.deleteClass).toHaveBeenCalledWith(
      NarrowNoteDialog
    );
  });
});
