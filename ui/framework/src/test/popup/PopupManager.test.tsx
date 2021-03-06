/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelAppOptions, LengthDescription, MockRender } from "@bentley/imodeljs-frontend";
import {
  AbstractToolbarProps, BadgeType, DialogItem, DialogItemValue, DialogPropertyItem, PropertyChangeResult,
  PropertyChangeStatus, PropertyDescription, RelativePosition, StandardTypeNames, UiDataProvider,
} from "@bentley/ui-abstract";
import { EditorContainer, Toolbar, ToolbarWithOverflow } from "@bentley/ui-components";
import { LeadingText, Point } from "@bentley/ui-core";
import { AccuDrawPopupManager } from "../../ui-framework/accudraw/AccuDrawPopupManager";
import { Calculator } from "../../ui-framework/accudraw/Calculator";
import { MenuButton } from "../../ui-framework/accudraw/MenuButton";
import { PopupManager, PopupRenderer } from "../../ui-framework/popup/PopupManager";
import { MenuItemProps } from "../../ui-framework/shared/MenuItem";
import TestUtils, { storageMock } from "../TestUtils";
import { Card } from "../../ui-framework/popup/CardPopup";
import { DialogGridContainer } from "../../ui-framework/uiprovider/DefaultDialogGridContainer";
import { FrameworkUiAdmin, KeyinEntry } from "../../ui-framework/uiadmin/FrameworkUiAdmin";
import { KeyinPalettePanel } from "../../ui-framework/popup/KeyinPalettePanel";
const myLocalStorage = storageMock();

describe("PopupManager", () => {
  const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => myLocalStorage,
    });

    await TestUtils.initializeUiFramework();
    // use mock renderer so standards tools are registered.
    const opts: IModelAppOptions = {uiAdmin: new FrameworkUiAdmin()};
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();
    // restore the overriden property getter
    Object.defineProperty(window, "localStorage", propertyDescriptorToRestore);
    TestUtils.terminateUiFramework();
  });


  beforeEach(() => {
    PopupManager.clearPopups();
  });

  describe("Manager API", () => {
    it("showMenuButton should add menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(100, 200), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
    });

    it("hideMenuButton should hide menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      const popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");

      AccuDrawPopupManager.hideMenuButton("test1");

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("hideMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccuDrawPopupManager.hideMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("showCalculator should show Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(100, 200), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
    });

    it("hideCalculator should hide Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);

      AccuDrawPopupManager.hideCalculator();

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("showInputEditor should show editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showAngleEditor(doc.documentElement, new Point(150, 250), 123, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showLengthEditor(doc.documentElement, new Point(100, 200), 123, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);

      AccuDrawPopupManager.showHeightEditor(doc.documentElement, new Point(200, 300), 256, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(200);
      expect(popup.pt.y).to.eq(300);

      const propertyDescription: PropertyDescription = { name: "test", displayLabel: "Test", typename: StandardTypeNames.Number };

      PopupManager.showInputEditor(doc.documentElement, new Point(300, 400), 256, propertyDescription, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(300);
      expect(popup.pt.y).to.eq(400);
    });

    it("hideInputEditor should hide editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new LengthDescription(), spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);

      PopupManager.hideInputEditor();

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("should be able to set offset", () => {
      expect(PopupManager.defaultOffset.x).to.eq(8);
      expect(PopupManager.defaultOffset.y).to.eq(8);

      PopupManager.defaultOffset = { x: 10, y: 10 };

      expect(PopupManager.defaultOffset.x).to.eq(10);
      expect(PopupManager.defaultOffset.y).to.eq(10);
    });

  });

  describe("PopupRenderer", () => {
    it("PopupRenderer should render", () => {
      const wrapper = mount(<PopupRenderer />);
      wrapper.unmount();
    });

    it("PopupRenderer should render menuButton with menu item", () => {
      const wrapper = mount(<PopupRenderer />);

      const menuItemProps: MenuItemProps[] = [
        { id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } } },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      wrapper.update();
      expect(wrapper.find(MenuButton).length).to.eq(1);

      wrapper.unmount();
    });

    it("PopupRenderer should render Calculator", () => {
      const wrapper = mount(<PopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      wrapper.update();
      expect(wrapper.find(Calculator).length).to.eq(1);

      wrapper.unmount();
    });

    it("PopupRenderer should render InputEditor", async () => {
      const wrapper = mount(<PopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();
      const description: PropertyDescription = {
        name: "test",
        displayLabel: "Test",
        typename: StandardTypeNames.Text,
      };

      PopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, description, spyCommit, spyCancel);
      wrapper.update();
      expect(wrapper.find(EditorContainer).length).to.eq(1);

      let inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("keyDown", { key: "Enter" });
      await TestUtils.flushAsyncOperations();
      expect(spyCommit.calledOnce).to.be.true;

      PopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, description, spyCommit, spyCancel);
      wrapper.update();
      expect(wrapper.find(EditorContainer).length).to.eq(1);

      inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.called).to.be.true;

      wrapper.unmount();
    });

    it("PopupRenderer should render Toolbar", async () => {
      const wrapper = mount(<PopupRenderer />);

      const toolbarProps: AbstractToolbarProps = {
        items: [
          { id: "Mode-1", itemPriority: 10, label: "Mode 1", icon: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } },
          { id: "Mode-2", itemPriority: 20, label: "Mode 2", icon: "icon-placeholder", execute: () => { } },
        ],
      };

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyItemExecuted = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showToolbar(toolbarProps, doc.documentElement, new Point(150, 250), new Point(8, 8), spyItemExecuted, spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(Toolbar).length).to.eq(1);

      const buttonNodes = wrapper.find("button");
      expect(buttonNodes.length).to.eq(2);

      buttonNodes.at(0).simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.calledOnce).to.be.true;

      wrapper.unmount();
    });

    it("PopupRenderer should render HTMLElement", async () => {
      const wrapper = mount(<PopupRenderer />);

      const html = "<div class='test-element'>Hello World!</div>";
      const display = new DOMParser().parseFromString(html, "text/html");

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCancel = sinon.spy();

      PopupManager.showHTMLElement(display.documentElement, doc.documentElement, new Point(150, 250), new Point(8, 8), spyCancel, RelativePosition.TopRight);
      wrapper.update();
      wrapper.should.matchSnapshot();

      wrapper.unmount();
    });

    it("PopupRenderer should render Card", async () => {
      const wrapper = mount(<PopupRenderer />);

      const html = '<div style="width: 120px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: aqua;">Hello World!</div>';
      const content = new DOMParser().parseFromString(html, "text/html");

      const toolbarProps: AbstractToolbarProps = {
        items: [
          { id: "Mode-1", itemPriority: 10, label: "Mode 1", icon: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } },
          { id: "Mode-2", itemPriority: 20, label: "Mode 2", icon: "icon-placeholder", execute: () => { } },
        ],
      };

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyItemExecuted = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showCard(content.documentElement, "Title", toolbarProps, doc.documentElement, new Point(150, 250), new Point(8, 8), spyItemExecuted, spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(Card).length).to.eq(1);
      expect(wrapper.find(LeadingText).length).to.eq(1);
      expect(wrapper.find(ToolbarWithOverflow).length).to.eq(1);

      const buttonNodes = wrapper.find("button");
      expect(buttonNodes.length).to.be.greaterThan(0);

      buttonNodes.at(0).simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.called).to.be.true;
      PopupManager.hideCard();

      const record = TestUtils.createPrimitiveStringProperty("record", "Title");
      PopupManager.showCard(content.documentElement, record, toolbarProps, doc.documentElement, new Point(150, 250), new Point(8, 8), spyItemExecuted, spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(Card).length).to.eq(1);
      expect(wrapper.find(LeadingText).length).to.eq(1);
      PopupManager.hideCard();

      PopupManager.showCard(content.documentElement, undefined, undefined, doc.documentElement, new Point(150, 250), new Point(8, 8), spyItemExecuted, spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(Card).length).to.eq(1);
      expect(wrapper.find(LeadingText).length).to.eq(0);
      PopupManager.hideCard();

      wrapper.unmount();
    });

    it("PopupRenderer should render Tool Settings", async () => {
      const wrapper = mount(<PopupRenderer />);
      const spyChange = sinon.spy();

      class TestUiDataProvider extends UiDataProvider {
        private static _sourcePropertyName = "source";
        private static _getSourceDescription = (): PropertyDescription => {
          return {
            name: TestUiDataProvider._sourcePropertyName,
            displayLabel: "Source",
            typename: StandardTypeNames.String,
          };
        }

        private _sourceValue: DialogItemValue = { value: "unknown" };

        public get source(): string {
          return this._sourceValue.value as string;
        }

        public set source(option: string) {
          this._sourceValue.value = option;
        }

        /** Called by UI to inform data provider of changes.  */
        public processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
          if (properties.length > 0) {
            for (const prop of properties) {
              if (prop.propertyName === TestUiDataProvider._sourcePropertyName) {
                this.source = prop.value.value ? prop.value.value as string : "";
                spyChange(this.source);
                continue;
              }
            }
          }
          return { status: PropertyChangeStatus.Success };
        }

        /** Used Called by UI to request available properties when UI is manually created. */
        public supplyDialogItems(): DialogItem[] | undefined {
          return [
            { value: this._sourceValue, property: TestUiDataProvider._getSourceDescription(), editorPosition: { rowPriority: 1, columnIndex: 1 } },
          ];
        }

      }
      const uiDataProvider = new TestUiDataProvider();

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCancel = sinon.spy();

      PopupManager.openToolSettings(uiDataProvider, doc.documentElement, new Point(150, 250), new Point(8, 8), spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(DialogGridContainer).length).to.eq(1);

      let inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.at(0).simulate("keyDown", { key: "Enter" });
      await TestUtils.flushAsyncOperations();
      expect(spyChange.calledOnce).to.be.true;

      PopupManager.openToolSettings(uiDataProvider, doc.documentElement, new Point(150, 250), new Point(8, 8), spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(DialogGridContainer).length).to.eq(1);

      inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.at(0).simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.calledOnce).to.be.true;

      wrapper.unmount();
    });

    it("PopupRenderer should render Keyin Palette", async () => {
      const wrapper = mount(<PopupRenderer />);
      const keyins: KeyinEntry[] = [{value: "keyin one"}, {value: "keyin two"}]
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showKeyinPalette(keyins, doc.documentElement, spyOk, spyCancel);

      wrapper.update();
      expect(wrapper.find(KeyinPalettePanel).length).to.eq(1);
      const inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);
      inputNode.at(0).simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.calledOnce).to.be.true;

      wrapper.unmount();
    });
  });

});
