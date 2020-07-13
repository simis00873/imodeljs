/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import produce from "immer";
import * as React from "react";
import * as sinon from "sinon";
import { Point } from "@bentley/ui-core";
import { act, fireEvent, render } from "@testing-library/react";
import {
  addPanelWidget, addTab, createNineZoneState, FloatingTab, NineZoneDispatch,
} from "../../ui-ninezone";
import { createDragItemInfo, NineZoneProvider } from "../Providers";
import { DragManager } from "../../ui-ninezone/base/DragManager";

describe("FloatingTab", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    const { container } = render(
      <NineZoneProvider
        state={nineZone}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    container.firstChild!.should.matchSnapshot();
  });

  it("should dispatch WIDGET_TAB_DRAG", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      fireEvent.mouseMove(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG",
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with tab target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "floatingWidget",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with floatingWidget target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "tab",
        tabIndex: 0,
        widgetId: "w1",
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "tab",
      },
    })).should.true;
  });

  it("should dispatch WIDGET_TAB_DRAG_END with panel target", () => {
    const dragManager = React.createRef<DragManager>();
    const dispatch = sinon.stub<NineZoneDispatch>();
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1", { label: "tab 1" });
    nineZone = produce(nineZone, (draft) => {
      draft.draggedTab = {
        position: new Point(10, 20).toProps(),
        tabId: "t1",
      };
    });
    render(
      <NineZoneProvider
        state={nineZone}
        dispatch={dispatch}
        dragManagerRef={dragManager}
      >
        <FloatingTab />
      </NineZoneProvider>,
    );
    act(() => {
      dragManager.current!.handleDragStart({
        info: createDragItemInfo(),
        item: {
          type: "tab",
          id: "t1",
        },
      });
      dragManager.current!.handleTargetChanged({
        type: "panel",
        side: "left",
      });
      fireEvent.mouseUp(document);
    });
    dispatch.calledOnceWithExactly(sinon.match({
      type: "WIDGET_TAB_DRAG_END",
      id: "t1",
      target: {
        type: "panel",
      },
    })).should.true;
  });
});