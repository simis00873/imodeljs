/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/promise-function-async */
import { expect } from "chai";
import * as faker from "faker";
import sinon from "sinon";
import { BeDuration, BeEvent, using } from "@bentley/bentleyjs-core";
import { IModelRpcProps } from "@bentley/imodeljs-common";
import { EventSource, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";
import {
  Content, ContentDescriptorRequestOptions, ContentRequestOptions, ContentUpdateInfo, Descriptor, DisplayLabelRequestOptions,
  DisplayLabelsRequestOptions, DisplayValueGroup, DistinctValuesRequestOptions, ExtendedContentRequestOptions, ExtendedHierarchyRequestOptions,
  FieldDescriptor, FieldDescriptorType, HierarchyRequestOptions, HierarchyUpdateInfo, InstanceKey, Item, KeySet, LabelDefinition, LabelRequestOptions,
  Node, NodeKey, NodePathElement, Paged, PresentationDataCompareOptions, PresentationError, PresentationRpcEvents, PresentationRpcInterface,
  PresentationStatus, PresentationUnitSystem, RegisteredRuleset, RequestPriority, RpcRequestsHandler, Ruleset, RulesetVariable, UpdateInfo,
  VariableValueTypes,
} from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  createRandomBaseNodeKey, createRandomDescriptor, createRandomECInstanceKey, createRandomECInstancesNode, createRandomECInstancesNodeKey,
  createRandomLabelDefinition, createRandomNodePathElement, createRandomRuleset,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import { Presentation } from "../presentation-frontend/Presentation";
import { buildPagedResponse, PresentationManager } from "../presentation-frontend/PresentationManager";
import { RulesetManagerImpl } from "../presentation-frontend/RulesetManager";
import { RulesetVariablesManagerImpl } from "../presentation-frontend/RulesetVariablesManager";

describe("PresentationManager", () => {

  const rulesetsManagerMock = moq.Mock.ofType<RulesetManagerImpl>();
  const rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
  let manager: PresentationManager;
  const i18nMock = moq.Mock.ofType<I18N>();
  const testData = {
    imodelToken: moq.Mock.ofType<IModelRpcProps>().object,
    imodelMock: moq.Mock.ofType<IModelConnection>(),
    pageOptions: { start: 0, size: 0 },
    rulesetId: "",
  };
  let rulesetManagerCreateStub: sinon.SinonSpy<[], RulesetManagerImpl>;

  beforeEach(() => {
    mockI18N();
    testData.imodelMock.reset();
    testData.imodelMock.setup((x) => x.getRpcProps()).returns(() => testData.imodelToken);
    testData.imodelMock.setup((x) => x.onClose).returns(() => new BeEvent());
    testData.pageOptions = { start: faker.random.number(), size: faker.random.number() };
    testData.rulesetId = faker.random.uuid();
    rulesetsManagerMock.reset();
    rulesetManagerCreateStub = sinon.stub(RulesetManagerImpl, "create").returns(rulesetsManagerMock.object);
    rpcRequestsHandlerMock.reset();
    manager = PresentationManager.create({
      rpcRequestsHandler: rpcRequestsHandlerMock.object,
    });
  });

  afterEach(() => {
    manager.dispose();
    Presentation.terminate();
  });

  const mockI18N = () => {
    i18nMock.reset();
    Presentation.setI18nManager(i18nMock.object);
    const resolvedPromise = new Promise<void>((resolve) => resolve());
    i18nMock.setup((x) => x.registerNamespace(moq.It.isAny())).returns((name: string) => new I18NNamespace(name, resolvedPromise));
    i18nMock.setup((x) => x.translate(moq.It.isAny(), moq.It.isAny())).returns((stringId) => stringId);
  };

  const toIModelTokenOptions = <TOptions extends { imodel: IModelConnection, locale?: string, unitSystem?: PresentationUnitSystem }>(requestOptions: TOptions) => {
    return {
      ...requestOptions,
      imodel: requestOptions.imodel.getRpcProps(),
    };
  };

  const addRulesetAndVariablesToOptions = <TOptions extends { rulesetId?: string, rulesetOrId?: Ruleset | string }>(options: TOptions) => {
    const { rulesetId, rulesetOrId } = options;

    let foundRulesetOrId;
    if (rulesetOrId && typeof rulesetOrId === "object") {
      foundRulesetOrId = rulesetOrId;
    } else {
      foundRulesetOrId = rulesetOrId || rulesetId || "";
    }

    return { ...options, rulesetOrId: foundRulesetOrId, rulesetVariables: [] };
  };

  const prepareOptions = <TOptions extends { imodel: IModelConnection, locale?: string, unitSystem?: PresentationUnitSystem, rulesetId?: string, rulesetOrId?: Ruleset | string }>(options: TOptions) => {
    return toIModelTokenOptions(addRulesetAndVariablesToOptions(options));
  };

  describe("constructor", () => {

    it("sets active locale if supplied with props", async () => {
      const props = { activeLocale: faker.locale };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeLocale).to.eq(props.activeLocale);
    });

    it("sets active unit system if supplied with props", async () => {
      const props = { activeUnitSystem: PresentationUnitSystem.UsSurvey };
      const mgr = PresentationManager.create(props);
      expect(mgr.activeUnitSystem).to.eq(props.activeUnitSystem);
    });

    it("sets custom RpcRequestsHandler if supplied with props", async () => {
      const handler = moq.Mock.ofType<RpcRequestsHandler>();
      const props = { rpcRequestsHandler: handler.object };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler).to.eq(handler.object);
    });

    it("sets RpcRequestsHandler clientId if supplied with props", async () => {
      const props = { clientId: faker.random.uuid() };
      const mgr = PresentationManager.create(props);
      expect(mgr.rpcRequestsHandler.clientId).to.eq(props.clientId);
    });

    it("starts listening to update events", async () => {
      sinon.stub(IModelApp, "isNativeApp").get(() => true);
      const eventSource = sinon.createStubInstance(EventSource) as unknown as EventSource;
      PresentationManager.create({ eventSource });
      expect(eventSource.on).to.be.calledOnceWith(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, sinon.match((arg) => typeof arg === "function"));
    });

  });

  describe("dispose", () => {

    it("disposes RPC requests handler", () => {
      manager.dispose();
      rpcRequestsHandlerMock.verify((x) => x.dispose(), moq.Times.once());
    });

    it("stops listening to update events", async () => {
      sinon.stub(IModelApp, "isNativeApp").get(() => true);
      const eventSource = sinon.createStubInstance(EventSource) as unknown as EventSource;
      using(PresentationManager.create({ eventSource }), (_) => { });
      expect(eventSource.off).to.be.calledOnceWith(PresentationRpcInterface.interfaceName, PresentationRpcEvents.Update, sinon.match((arg) => typeof arg === "function"));
    });

  });

  describe("onConnection", () => {

    it("caches IModelConnection and calls `onNewiModelConnection` for the first time", async () => {
      const spy = sinon.stub(manager, "onNewiModelConnection");
      const onCloseEvent = new BeEvent();
      const imodelMock = moq.Mock.ofType<IModelConnection>();
      imodelMock.setup((x) => x.onClose).returns(() => onCloseEvent);
      rpcRequestsHandlerMock.setup((x) => x.getNodesCount(moq.It.isAny())).returns(async () => 0);

      // expect the spy to be called on first imodel use
      await manager.getNodesCount({ // eslint-disable-line deprecation/deprecation
        imodel: imodelMock.object,
        rulesetOrId: testData.rulesetId,
      });
      expect(spy).to.be.calledOnceWith(imodelMock.object);
      spy.resetHistory();

      // expect the spy to not be called second time
      await manager.getNodesCount({ // eslint-disable-line deprecation/deprecation
        imodel: imodelMock.object,
        rulesetOrId: testData.rulesetId,
      });
      expect(spy).to.not.be.called;
      spy.resetHistory();

      // simulate imodel close
      onCloseEvent.raiseEvent();

      // expect the spy to be called again
      await manager.getNodesCount({ // eslint-disable-line deprecation/deprecation
        imodel: imodelMock.object,
        rulesetOrId: testData.rulesetId,
      });
      expect(spy).to.be.calledOnceWith(imodelMock.object);
    });

  });

  describe("activeLocale", () => {

    it("requests with manager's locale if not set in request options", async () => {
      const locale = faker.random.locale();
      manager.activeLocale = locale;
      await manager.getNodesCount({  // eslint-disable-line deprecation/deprecation
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        locale,
        rulesetVariables: [],
        parentKey: undefined,
      }), moq.Times.once());
    });

    it("requests with request's locale if set", async () => {
      const locale = faker.random.locale();
      manager.activeLocale = faker.random.locale();
      expect(manager.activeLocale).to.not.eq(locale);
      await manager.getNodesCount({  // eslint-disable-line deprecation/deprecation
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        locale,
      });
      rpcRequestsHandlerMock.verify((x) => x.getNodesCount({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        locale,
        rulesetVariables: [],
        parentKey: undefined,
      }), moq.Times.once());
    });

  });

  describe("activeUnitSystem", () => {

    it("requests with manager's unit system if not set in request options", async () => {
      const keys = new KeySet();
      const unitSystem = PresentationUnitSystem.UsSurvey;
      manager.activeUnitSystem = unitSystem;
      await manager.getContentDescriptor({
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        displayType: "",
        keys,
      });
      rpcRequestsHandlerMock.verify((x) => x.getContentDescriptor({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        unitSystem,
        rulesetVariables: [],
        displayType: "",
        keys: keys.toJSON(),
      }), moq.Times.once());
    });

    it("requests with request's locale if set", async () => {
      const keys = new KeySet();
      const unitSystem = PresentationUnitSystem.UsSurvey;
      manager.activeUnitSystem = PresentationUnitSystem.Metric;
      await manager.getContentDescriptor({
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        unitSystem,
        displayType: "",
        keys,
      });
      rpcRequestsHandlerMock.verify((x) => x.getContentDescriptor({
        imodel: testData.imodelToken,
        rulesetOrId: testData.rulesetId,
        unitSystem,
        rulesetVariables: [],
        displayType: "",
        keys: keys.toJSON(),
      }), moq.Times.once());
    });

  });

  describe("rulesets", () => {

    it("returns rulesets manager provided through props", () => {
      const rulesets = manager.rulesets();
      expect(rulesets).to.eq(rulesetsManagerMock.object);
    });

    it("returns an instance of `RulesetManagerImpl` if not provided through props", () => {
      rulesetManagerCreateStub.restore();
      manager = PresentationManager.create();
      const rulesets = manager.rulesets();
      expect(rulesets).to.be.instanceOf(RulesetManagerImpl);
    });

  });

  describe("vars", () => {

    it("returns ruleset variables manager", () => {
      const vars = manager.vars(testData.rulesetId);
      expect(vars).to.be.instanceOf(RulesetVariablesManagerImpl);

      const vars2 = manager.vars(testData.rulesetId);
      expect(vars2).to.equal(vars);
    });

  });

  describe("getNodesAndCount", () => {

    it("[deprecated] requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const count = 2;
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => ({ total: count, items: nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options, parentNodeKey); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq({ count, nodes });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests root nodes from proxy", async () => {
      const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const count = 2;
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions(options)))
        .returns(async () => ({ total: count, items: nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count, nodes });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const nodes = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const count = 2;
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => ({ total: count, items: nodes.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count, nodes });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes through multiple requests when getting partial responses", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const node1 = createRandomECInstancesNode();
      const node2 = createRandomECInstancesNode();
      const count = 2;
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey), paging: { start: 0, size: 0 } })))
        .returns(async () => ({ total: count, items: [Node.toJSON(node1)] }))
        .verifiable();
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey), paging: { start: 1, size: 0 } })))
        .returns(async () => ({ total: count, items: [Node.toJSON(node2)] }))
        .verifiable();
      const actualResult = await manager.getNodesAndCount(options);
      expect(actualResult).to.deep.eq({ count, nodes: [node1, node2] });
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodes", () => {

    it("[deprecated] requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const options: Paged<HierarchyRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => ({ total: 666, items: result.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodes(options, parentNodeKey); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests root nodes from proxy", async () => {
      const result = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions(options)))
        .returns(async () => ({ total: 666, items: result.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodes(options); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = [createRandomECInstancesNode(), createRandomECInstancesNode()];
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => ({ total: 666, items: result.map(Node.toJSON) }))
        .verifiable();
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes through multiple requests when getting partial responses", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const node1 = createRandomECInstancesNode();
      const node2 = createRandomECInstancesNode();
      const count = 2;
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey), paging: { start: 0, size: 0 } })))
        .returns(async () => ({ total: count, items: [Node.toJSON(node1)] }))
        .verifiable();
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedNodes(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey), paging: { start: 1, size: 0 } })))
        .returns(async () => ({ total: count, items: [Node.toJSON(node2)] }))
        .verifiable();
      const actualResult = await manager.getNodes(options);
      expect(actualResult).to.deep.eq([node1, node2]);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodesCount", () => {

    it("requests root nodes count from proxy", async () => {
      const result = faker.random.number();
      const options: ExtendedHierarchyRequestOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        parentKey: undefined,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(prepareOptions(options)))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = faker.random.number();
      const options: ExtendedHierarchyRequestOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        parentKey: parentNodeKey,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("[deprecated] requests child nodes count from proxy", async () => {
      const parentNodeKey = createRandomECInstancesNodeKey();
      const result = faker.random.number();
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(prepareOptions({ ...options, parentKey: NodeKey.toJSON(parentNodeKey) })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getNodesCount(options, parentNodeKey); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getFilteredNodePaths", () => {

    it("calls getFilteredNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getFilteredNodePaths(prepareOptions(options), "filter"))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getFilteredNodePaths(options, "filter");
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getNodePaths", () => {

    it("calls getNodePaths through proxy", async () => {
      const value = [createRandomNodePathElement(0), createRandomNodePathElement(0)];
      const keyArray = [[createRandomECInstanceKey(), createRandomECInstanceKey()]];
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.getNodePaths(prepareOptions(options), keyArray.map((k) => k.map(InstanceKey.toJSON)), 1))
        .returns(async () => value.map(NodePathElement.toJSON))
        .verifiable();
      const result = await manager.getNodePaths(options, keyArray, 1);
      expect(result).to.be.deep.equal(value);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("loadHierarchy", () => {

    it("calls loadHierarchy through proxy with default 'preload' priority", async () => {
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock.setup((x) => x.loadHierarchy({ ...prepareOptions(options), priority: RequestPriority.Preload }))
        .returns(async () => { })
        .verifiable();
      await manager.loadHierarchy(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("calls loadHierarchy through proxy with specified priority", async () => {
      const options: HierarchyRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        priority: 999,
      };
      rpcRequestsHandlerMock.setup((x) => x.loadHierarchy({ ...prepareOptions(options), priority: 999 }))
        .returns(async () => { })
        .verifiable();
      await manager.loadHierarchy(options);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentDescriptor", () => {

    it("[deprecated] requests descriptor from proxy", async () => {
      const keyset = new KeySet();
      const result = createRandomDescriptor();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(prepareOptions({ ...options, displayType: "test", keys: keyset.toJSON(), selection: undefined })))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options, "test", keyset, undefined); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests descriptor from proxy", async () => {
      const keyset = new KeySet();
      const result = createRandomDescriptor();
      const options: ContentDescriptorRequestOptions<IModelConnection, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        displayType: "test",
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(prepareOptions({ ...options, keys: keyset.toJSON() })))
        .returns(async () => result.toJSON())
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options);
      expect(actualResult).to.be.instanceOf(Descriptor);
      expect(actualResult!.toJSON()).to.deep.eq(result.toJSON());
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles undefined descriptor", async () => {
      const keyset = new KeySet();
      const options: ContentDescriptorRequestOptions<IModelConnection, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        displayType: "test",
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentDescriptor(prepareOptions({ ...options, keys: keyset.toJSON() })))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentDescriptor(options);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.be.undefined;
    });

  });

  describe("getContentSetSize", () => {

    it("[deprecated] requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = faker.random.number();
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentSetSize(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options, descriptor, keyset); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content set size from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = faker.random.number();
      const options: ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getContentSetSize(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const result = faker.random.number();
      const options: ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        descriptor: overrides,
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getContentSetSize(prepareOptions({ ...options, descriptor: overrides, keys: keyset.toJSON() })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getContentSetSize(options);
      expect(actualResult).to.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContent", () => {

    it("[deprecated] requests content from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        total: 999,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContentSet(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => ({ ...result, items: result.items.map((i) => i.toJSON()) }))
        .verifiable();
      const actualResult = await manager.getContent(options, descriptor, keyset); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.eq(descriptor);
      expect(actualResult!.contentSet).to.deep.eq(result.items);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        total: 999,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContentSet(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => ({ ...result, items: result.items.map((i) => i.toJSON()) }))
        .verifiable();
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.eq(descriptor);
      expect(actualResult!.contentSet).to.deep.eq(result.items);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const overrides = descriptor.createDescriptorOverrides();
      const items = [new Item([], "", "", undefined, {}, {}, [])];
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: overrides,
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContent(prepareOptions({ ...options, descriptor: overrides, keys: keyset.toJSON() })))
        .returns(async () => ({ descriptor: descriptor.toJSON(), contentSet: { total: 999, items: items.map((i) => i.toJSON()) } }))
        .verifiable();
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.instanceOf(Content);
      expect(actualResult!.descriptor).to.deep.eq(descriptor);
      expect(actualResult!.contentSet).to.deep.eq(items);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContent(prepareOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON() })))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContent(options);
      expect(actualResult).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getContentAndContentSize", () => {

    it("[deprecated] requests content and contentSize from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        total: 999,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ContentRequestOptions<IModelConnection>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContentSet(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => ({ ...result, items: result.items.map((i) => i.toJSON()) }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options, descriptor, keyset); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq({
        size: result.total,
        content: {
          descriptor,
          contentSet: result.items,
        },
      });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content and contentSize from proxy", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        total: 999,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor,
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContentSet(prepareOptions({ ...options, descriptor: descriptor.createStrippedDescriptor(), keys: keyset.toJSON() })))
        .returns(async () => ({ ...result, items: result.items.map((i) => i.toJSON()) }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: result.total,
        content: {
          descriptor,
          contentSet: result.items,
        },
      });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests content and content set size from proxy when descriptor overrides are passed instead of descriptor", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const result = {
        total: 999,
        items: [new Item([], "", "", undefined, {}, {}, [])],
      };
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContent(prepareOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON() })))
        .returns(async () => ({ descriptor: descriptor.toJSON(), contentSet: { ...result, items: result.items.map((i) => i.toJSON()) } }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: result.total,
        content: {
          descriptor,
          contentSet: result.items,
        },
      });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests full content only for the first partial request when using descriptor overrides and multiple partial requests are needed", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const item1 = new Item([], "", "", undefined, {}, {}, []);
      const item2 = new Item([], "", "", undefined, {}, {}, []);
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: { start: 0, size: 2 },
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContent(prepareOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), paging: { start: 0, size: 2 } })))
        .returns(async () => ({ descriptor: descriptor.toJSON(), contentSet: { total: 5, items: [item1.toJSON()] } }))
        .verifiable();
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContentSet(prepareOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON(), paging: { start: 1, size: 1 } })))
        .returns(async () => ({ total: 5, items: [item2.toJSON()] }))
        .verifiable();
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.deep.eq({
        size: 5,
        content: {
          descriptor,
          contentSet: [item1, item2],
        },
      });
      rpcRequestsHandlerMock.verifyAll();
    });

    it("handles case when response has no content", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const options: Paged<ExtendedContentRequestOptions<IModelConnection, Descriptor, KeySet>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        paging: testData.pageOptions,
        descriptor: descriptor.createDescriptorOverrides(),
        keys: keyset,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedContent(prepareOptions({ ...options, descriptor: descriptor.createDescriptorOverrides(), keys: keyset.toJSON() })))
        .returns(async () => undefined)
        .verifiable();
      const actualResult = await manager.getContentAndSize(options);
      expect(actualResult).to.be.undefined;
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("[deprecated] getDistinctValues", () => {

    it("requests distinct values", async () => {
      const keyset = new KeySet();
      const descriptor = createRandomDescriptor();
      const fieldName = faker.random.word();
      const maximumValueCount = faker.random.number();
      const result = [faker.random.word(), faker.random.word()];
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(prepareOptions(options),
          moq.deepEquals(descriptor.createStrippedDescriptor()),
          moq.deepEquals(keyset.toJSON()), fieldName, maximumValueCount))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDistinctValues(options, descriptor, keyset, fieldName, maximumValueCount);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("passes 0 for maximumValueCount by default", async () => {
      const options: ContentRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getDistinctValues(moq.It.isAny(), moq.It.isAny(), moq.It.isAny(), moq.It.isAnyString(), 0))
        .verifiable();
      await manager.getDistinctValues(options, createRandomDescriptor(), new KeySet(), "");
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getPagedDistinctValues", () => {

    it("requests distinct values", async () => {
      const keys = new KeySet();
      const descriptor = createRandomDescriptor();
      const fieldDescriptor: FieldDescriptor = {
        type: FieldDescriptorType.Name,
        fieldName: faker.random.word(),
      };
      const result = {
        total: 1,
        items: [{
          displayValue: faker.random.word(),
          groupedRawValues: [faker.random.word(), faker.random.word()],
        }],
      };
      const managerOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys,
        fieldDescriptor,
      };
      const rpcHandlerOptions = {
        ...prepareOptions(managerOptions),
        descriptor: descriptor.createStrippedDescriptor(),
        keys: keys.toJSON(),
        paging: { start: 0, size: 0 },
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedDistinctValues(rpcHandlerOptions))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getPagedDistinctValues(managerOptions);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.deep.eq(result);
    });

    it("requests distinct values through multiple requests when getting partial responses", async () => {
      const keys = new KeySet();
      const descriptor = createRandomDescriptor();
      const fieldDescriptor: FieldDescriptor = {
        type: FieldDescriptorType.Name,
        fieldName: faker.random.word(),
      };
      const item1 = {
        displayValue: faker.random.word(),
        groupedRawValues: [faker.random.word(), faker.random.word()],
      };
      const item2 = {
        displayValue: faker.random.word(),
        groupedRawValues: [faker.random.word(), faker.random.word()],
      };
      const managerOptions: DistinctValuesRequestOptions<IModelConnection, Descriptor, KeySet> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testData.rulesetId,
        descriptor,
        keys,
        fieldDescriptor,
        paging: undefined,
      };
      const rpcHandlerOptions = {
        ...prepareOptions(managerOptions),
        descriptor: descriptor.createStrippedDescriptor(),
        keys: keys.toJSON(),
      };
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedDistinctValues({ ...rpcHandlerOptions, paging: { start: 0, size: 0 } }))
        .returns(async () => ({ total: 2, items: [DisplayValueGroup.toJSON(item1)] }))
        .verifiable();
      rpcRequestsHandlerMock
        .setup((x) => x.getPagedDistinctValues({ ...rpcHandlerOptions, paging: { start: 1, size: 0 } }))
        .returns(async () => ({ total: 2, items: [DisplayValueGroup.toJSON(item2)] }))
        .verifiable();
      const actualResult = await manager.getPagedDistinctValues(managerOptions);
      rpcRequestsHandlerMock.verifyAll();
      expect(actualResult).to.deep.eq({ total: 2, items: [item1, item2] });
    });

  });

  describe("getDisplayLabelDefinition", () => {

    it("[deprecated] requests display label definition", async () => {
      const key = createRandomECInstanceKey();
      const result = createRandomLabelDefinition();
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabelDefinition(toIModelTokenOptions({ ...options, key: InstanceKey.toJSON(key) })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinition(options, key); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests display label definition", async () => {
      const result = createRandomLabelDefinition();
      const options: DisplayLabelRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodelMock.object,
        key: createRandomECInstanceKey(),
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getDisplayLabelDefinition(toIModelTokenOptions({ ...options, key: InstanceKey.toJSON(options.key) })))
        .returns(async () => result)
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinition(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("getDisplayLabelDefinitions", () => {

    it("[deprecated] requests display labels definitions", async () => {
      const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
      const result = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      const options: LabelRequestOptions<IModelConnection> = {
        imodel: testData.imodelMock.object,
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedDisplayLabelDefinitions(toIModelTokenOptions({ ...options, keys: keys.map(InstanceKey.toJSON) })))
        .returns(async () => ({ total: 2, items: result }))
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinitions(options, keys); // eslint-disable-line deprecation/deprecation
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests display labels definitions", async () => {
      const result = [createRandomLabelDefinition(), createRandomLabelDefinition()];
      const options: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodelMock.object,
        keys: [createRandomECInstanceKey(), createRandomECInstanceKey()],
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedDisplayLabelDefinitions(toIModelTokenOptions({ ...options, keys: options.keys.map(InstanceKey.toJSON) })))
        .returns(async () => ({ total: 2, items: result.map(LabelDefinition.toJSON) }))
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinitions(options);
      expect(actualResult).to.deep.eq(result);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("requests display labels definitions through multiple requests when getting partial responses", async () => {
      const key1 = createRandomECInstanceKey();
      const key2 = createRandomECInstanceKey();
      const def1 = createRandomLabelDefinition();
      const def2 = createRandomLabelDefinition();
      const options: DisplayLabelsRequestOptions<IModelConnection, InstanceKey> = {
        imodel: testData.imodelMock.object,
        keys: [key1, key2],
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedDisplayLabelDefinitions(toIModelTokenOptions({ ...options, keys: [key1, key2].map(InstanceKey.toJSON) })))
        .returns(async () => ({ total: 2, items: [LabelDefinition.toJSON(def1)] }))
        .verifiable();
      rpcRequestsHandlerMock
        .setup(async (x) => x.getPagedDisplayLabelDefinitions(toIModelTokenOptions({ ...options, keys: [InstanceKey.toJSON(key2)] })))
        .returns(async () => ({ total: 2, items: [LabelDefinition.toJSON(def2)] }))
        .verifiable();
      const actualResult = await manager.getDisplayLabelDefinitions(options);
      expect(actualResult).to.deep.eq([def1, def2]);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("compareHierarchies", () => {

    it("returns empty result when neither ruleset nor variables changed", async () => {
      const options: PresentationDataCompareOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        prev: {},
        rulesetOrId: "test",
      };
      const actualResult = await manager.compareHierarchies(options);
      rpcRequestsHandlerMock.verify(async (x) => x.compareHierarchies(moq.It.isAny()), moq.Times.never());
      expect(actualResult).to.deep.eq([]);
    });

    it("returns empty result when comparison is canceled", async () => {
      const options: PresentationDataCompareOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        prev: {
          rulesetOrId: "test1",
        },
        rulesetOrId: "test2",
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.compareHierarchies(prepareOptions({ ...options })))
        .throws(new PresentationError(PresentationStatus.Canceled))
        .verifiable();
      const actualResult = await manager.compareHierarchies(options);
      rpcRequestsHandlerMock.verify(async (x) => x.compareHierarchies(moq.It.isAny()), moq.Times.once());
      expect(actualResult).to.deep.eq([]);
    });

    it("throws when request handler throws non-cancelation exception", async () => {
      const options: PresentationDataCompareOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        prev: {
          rulesetVariables: [],
        },
        rulesetOrId: "test",
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.compareHierarchies(prepareOptions({ ...options })))
        .throws(new PresentationError(PresentationStatus.Error))
        .verifiable();
      await expect(manager.compareHierarchies(options)).to.eventually.be.rejectedWith(PresentationError);
      rpcRequestsHandlerMock.verify(async (x) => x.compareHierarchies(moq.It.isAny()), moq.Times.once());
    });

    it("requests hierarchy comparison and returns result", async () => {
      const options: PresentationDataCompareOptions<IModelConnection, NodeKey> = {
        imodel: testData.imodelMock.object,
        prev: {
          rulesetOrId: "test1",
          rulesetVariables: [],
        },
        rulesetOrId: "test",
        rulesetVariables: [],
        expandedNodeKeys: [createRandomBaseNodeKey()],
      };
      rpcRequestsHandlerMock
        .setup(async (x) => x.compareHierarchies(prepareOptions({ ...options, expandedNodeKeys: options.expandedNodeKeys!.map(NodeKey.toJSON) })))
        .throws(new PresentationError(PresentationStatus.Error))
        .verifiable();
      await expect(manager.compareHierarchies(options)).to.eventually.be.rejectedWith(PresentationError);
      rpcRequestsHandlerMock.verify(async (x) => x.compareHierarchies(moq.It.isAny()), moq.Times.once());
    });

  });

  describe("options handling", () => {

    let testRuleset: Ruleset;
    let testRulesetVariable: RulesetVariable;

    beforeEach(async () => {
      testRuleset = await createRandomRuleset();
      rulesetsManagerMock.setup((x) => x.get(testRuleset.id)).returns(async () => new RegisteredRuleset(testRuleset, "", () => { }));
      testRulesetVariable = { id: faker.random.word(), type: VariableValueTypes.String, value: faker.random.word() };
      await manager.vars(testRuleset.id).setString(testRulesetVariable.id, testRulesetVariable.value as string);
    });

    it("adds ruleset to the options", async () => {
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset.id,
        parentKey: undefined,
      };
      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions)))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("leaves ruleset in the options if already provided", async () => {
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        rulesetOrId: testRuleset,
        paging: testData.pageOptions,
        parentKey: undefined,
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [testRulesetVariable] };

      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions)))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("adds empty values if ruleset and rulesetId is not provided", async () => {
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: "",
        parentKey: undefined,
      };
      const expectedOptions = { ...options, rulesetVariables: [] };
      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions)))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

    it("appends ruleset variables from ruleset variables manager", async () => {
      const rulesetVariable = { id: faker.random.word(), type: VariableValueTypes.String, value: faker.random.word() };
      const options: Paged<ExtendedHierarchyRequestOptions<IModelConnection, NodeKey>> = {
        imodel: testData.imodelMock.object,
        paging: testData.pageOptions,
        rulesetOrId: testRuleset,
        rulesetVariables: [rulesetVariable],
        parentKey: undefined,
      };

      const expectedOptions = { ...options, rulesetOrId: testRuleset, rulesetVariables: [rulesetVariable, testRulesetVariable] };

      rpcRequestsHandlerMock
        .setup((x) => x.getNodesCount(toIModelTokenOptions(expectedOptions)))
        .returns(async () => 0)
        .verifiable();
      await manager.getNodesCount(options);
      rpcRequestsHandlerMock.verifyAll();
    });

  });

  describe("listening to updates", () => {

    let eventSourceListener: (report: UpdateInfo) => void;
    let hierarchyUpdatesSpy: sinon.SinonSpy<[{ ruleset: Ruleset, updateInfo: HierarchyUpdateInfo }], void>;
    let contentUpdatesSpy: sinon.SinonSpy<[{ ruleset: Ruleset, updateInfo: ContentUpdateInfo }], void>;

    beforeEach(() => {
      sinon.stub(IModelApp, "isNativeApp").get(() => true);

      const eventSource = sinon.createStubInstance(EventSource);
      manager = PresentationManager.create({ eventSource: eventSource as unknown as EventSource });

      eventSourceListener = eventSource.on.args[0][2];
      expect(eventSourceListener).to.not.be.undefined;

      hierarchyUpdatesSpy = sinon.spy() as any;
      manager.onIModelHierarchyChanged.addListener(hierarchyUpdatesSpy);

      contentUpdatesSpy = sinon.spy() as any;
      manager.onIModelContentChanged.addListener(contentUpdatesSpy);
    });

    it("triggers appropriate hierarchy and content events on update event", async () => {
      const ruleset1: Ruleset = { id: "1", rules: [] };
      const ruleset2: Ruleset = { id: "2", rules: [] };
      const ruleset3: Ruleset = { id: "3", rules: [] };
      const ruleset4: Ruleset = { id: "4", rules: [] };
      rulesetsManagerMock.setup((x) => x.get(ruleset1.id)).returns(async () => new RegisteredRuleset(ruleset1, "", () => { }));
      rulesetsManagerMock.setup((x) => x.get(ruleset2.id)).returns(async () => new RegisteredRuleset(ruleset2, "", () => { }));
      rulesetsManagerMock.setup((x) => x.get(ruleset3.id)).returns(async () => new RegisteredRuleset(ruleset3, "", () => { }));
      rulesetsManagerMock.setup((x) => x.get(ruleset4.id)).returns(async () => undefined);

      const report: UpdateInfo = {
        [ruleset1.id]: {
          hierarchy: "FULL",
          content: "FULL",
        },
        [ruleset2.id]: {
          hierarchy: [],
        },
        [ruleset3.id]: {
          content: "FULL",
        },
        [ruleset4.id]: {},
      };
      eventSourceListener(report);

      // workaround for a floating promise...
      await BeDuration.wait(1);

      expect(hierarchyUpdatesSpy).to.be.calledTwice;
      expect(hierarchyUpdatesSpy.firstCall).to.be.calledWith({
        ruleset: sinon.match((r) => r.id === ruleset1.id),
        updateInfo: "FULL",
      });
      expect(hierarchyUpdatesSpy.secondCall).to.be.calledWith({
        ruleset: sinon.match((r) => r.id === ruleset2.id),
        updateInfo: [],
      });

      expect(contentUpdatesSpy).to.be.calledTwice;
      expect(contentUpdatesSpy.firstCall).to.be.calledWith({
        ruleset: sinon.match((r) => r.id === ruleset1.id),
        updateInfo: "FULL",
      });
      expect(contentUpdatesSpy.secondCall).to.be.calledWith({
        ruleset: sinon.match((r) => r.id === ruleset3.id),
        updateInfo: "FULL",
      });
    });

  });

  describe("buildPagedResponse", () => {

    it("calls getter once with 0,0 partial page options when given `undefined` page options", async () => {
      const getter = sinon.stub().resolves({ total: 0, items: [] });
      await buildPagedResponse(undefined, getter);
      expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
    });

    it("calls getter once with 0,0 partial page options when given empty page options", async () => {
      const getter = sinon.stub().resolves({ total: 0, items: [] });
      await buildPagedResponse({}, getter);
      expect(getter).to.be.calledOnceWith({ start: 0, size: 0 });
    });

    it("calls getter once with partial page options equal to given page options", async () => {
      const getter = sinon.stub().resolves({ total: 0, items: [] });
      await buildPagedResponse({ start: 1, size: 2 }, getter);
      expect(getter).to.be.calledOnceWith({ start: 1, size: 2 });
    });

    it("calls getter multiple times until the whole requested page is received when requesting a page of specified size", async () => {
      const getter = sinon.stub();
      getter.onFirstCall().resolves({ total: 5, items: [2] });
      getter.onSecondCall().resolves({ total: 5, items: [3] });
      getter.onThirdCall().resolves({ total: 5, items: [4] });
      const result = await buildPagedResponse({ start: 1, size: 3 }, getter);
      expect(getter).to.be.calledThrice;
      expect(getter.firstCall).to.be.calledWith({ start: 1, size: 3 });
      expect(getter.secondCall).to.be.calledWith({ start: 2, size: 2 });
      expect(getter.thirdCall).to.be.calledWith({ start: 3, size: 1 });
      expect(result).to.deep.eq({ total: 5, items: [2, 3, 4] });
    });

    it("calls getter multiple times until the whole requested page is received when requesting a page of unspecified size", async () => {
      const getter = sinon.stub();
      getter.onFirstCall().resolves({ total: 5, items: [2, 3] });
      getter.onSecondCall().resolves({ total: 5, items: [4, 5] });
      const result = await buildPagedResponse({ start: 1 }, getter);
      expect(getter).to.be.calledTwice;
      expect(getter.firstCall).to.be.calledWith({ start: 1, size: 0 });
      expect(getter.secondCall).to.be.calledWith({ start: 3, size: 0 });
      expect(result).to.deep.eq({ total: 5, items: [2, 3, 4, 5] });
    });

  });

});
