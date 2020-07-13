/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AuthorizedClientRequestContext, ITwinClientLoggerCategory } from "@bentley/itwin-client";
import { BentleyLoggerCategory, Config, DbResult, Id64, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { ChangeSet, IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";
import { BackendLoggerCategory, BriefcaseManager, ECSqlStatement, ExternalSourceAspect, IModelDb, IModelHost, IModelHostConfiguration, IModelJsFs, NativeLoggerCategory, PhysicalPartition, Subject } from "@bentley/imodeljs-backend";

import { HubUtility } from "./integration/HubUtility";
import * as path from "path";
import { assert } from "chai";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelBankArgs, IModelBankUtils } from "../IModelBankUtils";
import { IModelHubUtils } from "../IModelHubUtils";
import { BridgeLoggerCategory } from "../BridgeLoggerCategory";
import { CodeSpecs, RectangleTile, SmallSquareTile } from "./integration/TestBridgeElements";
import { BridgeJobDefArgs } from "../imodel-bridge";
import { IModel } from "@bentley/imodeljs-common";
import { ModelNames } from "./integration/TestiModelBridge";

export class TestIModelInfo {
  private _name: string;
  private _id: string;
  private _localReadonlyPath: string;
  private _localReadWritePath: string;
  private _changeSets: ChangeSet[];

  constructor(name: string) {
    this._name = name;
    this._id = "";
    this._localReadonlyPath = "";
    this._localReadWritePath = "";
    this._changeSets = [];
  }

  get name(): string { return this._name; }
  set name(name: string) { this._name = name; }
  get id(): string { return this._id; }
  set id(id: string) { this._id = id; }
  get localReadonlyPath(): string { return this._localReadonlyPath; }
  set localReadonlyPath(localReadonlyPath: string) { this._localReadonlyPath = localReadonlyPath; }
  get localReadWritePath(): string { return this._localReadWritePath; }
  set localReadWritePath(localReadWritePath: string) { this._localReadWritePath = localReadWritePath; }
  get changeSets(): ChangeSet[] { return this._changeSets; }
  set changeSets(changeSets: ChangeSet[]) { this._changeSets = changeSets; }
}

function getCount(imodel: IModelDb, className: string) {
  let count = 0;
  imodel.withPreparedStatement("SELECT count(*) AS [count] FROM " + className, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}

export class BridgeTestUtils {
  public static setupLogging() {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);

    if (process.env.imjs_test_logging_config === undefined) {
      // tslint:disable-next-line:no-console
      console.log(`You can set the environment variable imjs_test_logging_config to point to a logging configuration json file.`);
    }
    const loggingConfigFile: string = process.env.imjs_test_logging_config || path.join(__dirname, "logging.config.json");

    if (IModelJsFs.existsSync(loggingConfigFile)) {
      // tslint:disable-next-line:no-console
      console.log(`Setting up logging levels from ${loggingConfigFile}`);
      // tslint:disable-next-line:no-var-requires
      Logger.configureLevels(require(loggingConfigFile));
    }
  }

  private static initDebugLogLevels(reset?: boolean) {
    Logger.setLevelDefault(reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(BentleyLoggerCategory.Performance, reset ? LogLevel.Error : LogLevel.Info);
    Logger.setLevel(BackendLoggerCategory.IModelDb, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(BridgeLoggerCategory.Framework, reset ? LogLevel.Error : LogLevel.Trace);
    Logger.setLevel(ITwinClientLoggerCategory.Clients, reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(IModelHubClientLoggerCategory.IModelHub, reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(ITwinClientLoggerCategory.Request, reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(NativeLoggerCategory.DgnCore, reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(NativeLoggerCategory.BeSQLite, reset ? LogLevel.Error : LogLevel.Warning);
    Logger.setLevel(NativeLoggerCategory.Licensing, reset ? LogLevel.Error : LogLevel.Warning);
  }

  // Setup typical programmatic log level overrides here
  // Convenience method used to debug specific tests/fixtures
  public static setupDebugLogLevels() {
    BridgeTestUtils.initDebugLogLevels(false);
  }

  public static resetDebugLogLevels() {
    BridgeTestUtils.initDebugLogLevels(true);
  }

  public static async getTestModelInfo(requestContext: AuthorizedClientRequestContext, testProjectId: string, iModelName: string): Promise<TestIModelInfo> {
    const iModelInfo = new TestIModelInfo(iModelName);
    iModelInfo.id = await HubUtility.queryIModelIdByName(requestContext, testProjectId, iModelInfo.name);

    iModelInfo.changeSets = await BriefcaseManager.imodelClient.changeSets.get(requestContext, iModelInfo.id);
    return iModelInfo;
  }

  public static async startBackend(clientArgs?: IModelBankArgs): Promise<void> {
    IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);
    const config = new IModelHostConfiguration();
    config.concurrentQuery.concurrent = 4; // for test restrict this to two threads. Making closing connection faster
    config.cacheDir = KnownTestLocations.outputDir;
    config.imodelClient = (undefined === clientArgs) ? IModelHubUtils.makeIModelClient() : IModelBankUtils.makeIModelClient(clientArgs);
    await IModelHost.startup(config);
  }

  public static async shutdownBackend(): Promise<void> {
    await IModelHost.shutdown();
  }

  public static verifyIModel(imodel: IModelDb, bridgeJobDef: BridgeJobDefArgs, isUpdate: boolean = false) {
    // Confirm the schema was imported simply by trying to get the meta data for one of the classes.
    assert.isDefined(imodel.getMetaData("TestBridge:TestBridgeGroup"));
    assert.equal(1, getCount(imodel, "BisCore:RepositoryLink"));
    assert.equal(1, getCount(imodel, "BisCore:PhysicalModel"));
    assert.equal(1, getCount(imodel, "TestBridge:TestBridgeGroupModel"));
    assert.equal(8, getCount(imodel, "BisCore:GeometryPart"));
    assert.equal(1, getCount(imodel, "BisCore:SpatialCategory"));
    assert.equal(2, getCount(imodel, "BisCore:RenderMaterial"));
    assert.equal(2, getCount(imodel, "TestBridge:TestBridgeGroup"));
    assert.equal(41, getCount(imodel, "TestBridge:TestBridgePhysicalElement"));
    assert.equal(6, getCount(imodel, "TestBridge:EquilateralTriangleTile"));
    assert.equal(8, getCount(imodel, "TestBridge:IsoscelesTriangleTile"));
    assert.equal(isUpdate ? 7 : 8, getCount(imodel, "TestBridge:LargeSquareTile"));
    assert.equal(isUpdate ? 2 : 1, getCount(imodel, "TestBridge:RectangleTile"));
    assert.equal(10, getCount(imodel, "TestBridge:RightTriangleTile"));
    assert.equal(8, getCount(imodel, "TestBridge:SmallSquareTile"));

    assert.isTrue(imodel.codeSpecs.hasName(CodeSpecs.Group));
    const jobSubjectName = "TestiModelBridge:" + bridgeJobDef.sourcePath!;
    const subjectId: Id64String = imodel.elements.queryElementIdByCode(Subject.createCode(imodel, IModel.rootSubjectId, jobSubjectName))!;
    assert.isTrue(Id64.isValidId64(subjectId));

    const physicalModelId = imodel.elements.queryElementIdByCode(PhysicalPartition.createCode(imodel, subjectId, ModelNames.Physical));
    assert.isTrue(physicalModelId !== undefined);
    assert.isTrue(Id64.isValidId64(physicalModelId!));

    // Verify some elements
    if (!isUpdate) {
      const ids = ExternalSourceAspect.findBySource(imodel, physicalModelId!, "Tile", "e1aa3ec3-0c2e-4328-89d0-08e1b4d446c8");
      assert.isTrue(Id64.isValidId64(ids.aspectId!));
      assert.isTrue(Id64.isValidId64(ids.elementId!));
      const tile = imodel.elements.getElement(ids.elementId!) as SmallSquareTile;
      assert.equal(tile.condition, "New");
    } else {
      // Modified element
      let ids = ExternalSourceAspect.findBySource(imodel, physicalModelId!, "Tile", "e1aa3ec3-0c2e-4328-89d0-08e1b4d446c8");
      assert.isTrue(Id64.isValidId64(ids.aspectId!));
      assert.isTrue(Id64.isValidId64(ids.elementId!));
      let tile = imodel.elements.getElement(ids.elementId!) as SmallSquareTile;
      assert.equal(tile.condition, "Scratched");

      // New element
      ids = ExternalSourceAspect.findBySource(imodel, physicalModelId!, "Tile", "5b51a06f-4026-4d0d-9674-d8428b118e9a");
      assert.isTrue(Id64.isValidId64(ids.aspectId!));
      assert.isTrue(Id64.isValidId64(ids.elementId!));
      tile = imodel.elements.getElement(ids.elementId!) as RectangleTile;
      assert.equal(tile.placement.origin.x, 1.0);
      assert.equal(tile.placement.origin.y, 2.0);
    }
  }
}